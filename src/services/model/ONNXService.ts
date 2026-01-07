import * as ort from 'onnxruntime-web/webgpu'
import type { Vector2 } from 'three'
import { RegressionMonitor } from '@/services/regression/regressionMonitor'
import { createLogger } from '@/utils/logger'
import type { ModelService } from './modelService'

// Use a const that gets replaced by Vite at build time
declare const __DEV__: boolean
const IS_DEV: boolean = __DEV__

const logger = createLogger('ONNXService')

const EPS = 1e-6
const MAX_DENSITY_SCALE = 10

export default class ONNXService implements ModelService {
  private logger = logger
  private monitor = IS_DEV
    ? new RegressionMonitor()
    : (null as unknown as RegressionMonitor)
  private frameNumber = 0
  private monitorSampleInterval = 5
  private monitorBuffers: {
    density: Float32Array
    velocityX: Float32Array
    velocityY: Float32Array
  } | null = null
  session: ort.InferenceSession | null
  gridSize: [number, number]
  batchSize: number
  channelSize: number
  outputChannelSize: number
  mass: number
  fpsLimit: number

  private tensorShape: [number, number, number, number]
  private tensorSize: number
  private outputSize: number
  private outputCallback!: (data: Float32Array) => void
  private matrixArray: Float32Array
  // 0: partial density
  // 1, 2: partial velocity
  // 3, 4: Force (currently not used)

  private isPaused: boolean
  // hold constructor private to prevent direct instantiation
  // ort.InferenceSession.create() is async,
  // so we need to use a static async method to create an instance
  private constructor() {
    this.session = null
    this.matrixArray = new Float32Array()
    // matrixData and matrixTensor must be sync.
    this.gridSize = [0, 0]
    this.batchSize = 0
    this.tensorShape = [0, 0, 0, 0]
    this.tensorSize = 0
    this.outputSize = 0
    this.isPaused = true
    this.channelSize = 0
    this.outputChannelSize = 0
    this.mass = 0
    this.fpsLimit = 30
  }

  // static async method to create an instance
  static async createService(
    modelPath: string,
    gridSize: [number, number] = [64, 64],
    batchSize = 1,
    channelSize = 5,
    outputChannelSize = 3,
    fpsLimit = 15,
    backend = 'wasm',
  ): Promise<ONNXService> {
    logger.debug('Creating ONNX model service')
    const modelServices = new ONNXService()
    await modelServices.init(
      modelPath,
      gridSize,
      batchSize,
      channelSize,
      outputChannelSize,
      backend,
    )
    modelServices.fpsLimit = fpsLimit
    logger.debug('ONNX model service created')
    return modelServices
  }

  bindOutput(callback: (data: Float32Array) => void): void {
    this.outputCallback = callback
  }

  startSimulation(): void {
    this.isPaused = false
    this.iterate()
  }

  pauseSimulation(): void {
    this.isPaused = true
  }

  private async init(
    modelPath: string,
    gridSize: [number, number],
    batchSize: number,
    channelSize: number,
    outputChannelSize: number,
    backend: string,
  ): Promise<void> {
    this.logger.debug('Initializing ONNX session')
    const metaUrl = new URL(import.meta.url)
    this.logger.debug('Meta URL', { metaUrl: metaUrl.href })
    // Configure WASM paths for onnxruntime-web
    // In dev: use node_modules path directly
    // In prod: use assets path where files are copied during build
    const isDev = import.meta.env.DEV
    if (isDev) {
      // In dev, serve from node_modules
      ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/'
    } else {
      // In prod, serve from assets (copied by Vite's asset handling)
      ort.env.wasm.wasmPaths = '/assets/'
    }
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: [backend],
      graphOptimizationLevel: 'all',
    })
    this.logger.debug('ONNX session created')
    this.channelSize = channelSize
    this.outputChannelSize = outputChannelSize
    this.gridSize = gridSize
    this.batchSize = batchSize
    this.tensorShape = [batchSize, gridSize[0], gridSize[1], channelSize]
    this.tensorSize = batchSize * gridSize[0] * gridSize[1] * channelSize
    this.outputSize = batchSize * gridSize[0] * gridSize[1] * outputChannelSize
  }

  loadDataArray(data: number[][][][]): void {
    this.logger.debug('Loading data array', {
      shape: `${data.length}x${data[0]?.length}x${data[0]?.[0]?.length}x${data[0]?.[0]?.[0]?.length}`,
    })
    this.matrixArray = new Float32Array(data.flat(3))
    this.normalizeMatrix(this.matrixArray)
    if (this.matrixArray.length !== this.tensorSize) {
      throw new Error(
        `matrixArray length ${this.matrixArray.length} does not match tensorSize ${this.tensorSize}`,
      )
    }
    this.matrixArray = this.matrixMap(this.matrixArray, [0, 1], v =>
      Math.max(v, 0),
    )
    this.mass = this.matrixSum(this.matrixArray, [0, 1])
  }

  private iterate(): void {
    if (this.session == null) {
      throw new Error(
        'session is null, createModelServices() must be called at first',
      )
    }
    this.logger.debug('Starting simulation iteration')
    const inputEnergy = this.matrixSum(
      this.matrixArray,
      [1, 5],
      value => value ** 2,
    )
    const inputTensor = new ort.Tensor(
      'float32',
      this.matrixArray,
      this.tensorShape,
    )
    const feeds: Record<string, ort.Tensor> = {}
    feeds[this.session.inputNames[0]] = inputTensor
    const startTime = performance.now()
    this.session
      .run(feeds)
      .then(outputs => {
        // check if the output canbe downcasted to Float32Array
        const outputName = this.session?.outputNames[0]
        if (
          !outputName ||
          outputs[outputName] === undefined ||
          !(outputs[outputName].data instanceof Float32Array)
        ) {
          throw new Error('output data is not Float32Array')
        }

        const outputData = this.constrainOutput(
          outputs[outputName].data as Float32Array,
          inputEnergy,
        )

        // Regression monitoring (dev only)
        if (IS_DEV) {
          const inferenceTime = performance.now() - startTime

          this.frameNumber++
          if (this.frameNumber % this.monitorSampleInterval === 0) {
            // Extract density and velocity from output (format: [d0, vx0, vy0, d1, vx1, vy1, ...])
            const n = outputData.length / 3
            if (
              this.monitorBuffers == null ||
              this.monitorBuffers.density.length !== n
            ) {
              this.monitorBuffers = {
                density: new Float32Array(n),
                velocityX: new Float32Array(n),
                velocityY: new Float32Array(n),
              }
            }
            const { density, velocityX, velocityY } = this.monitorBuffers
            for (let i = 0; i < n; i++) {
              density[i] = outputData[i * 3]
              velocityX[i] = outputData[i * 3 + 1]
              velocityY[i] = outputData[i * 3 + 2]
            }

            this.monitor.monitorFrame(
              density,
              velocityX,
              velocityY,
              inferenceTime,
              this.logger,
            )
          }
        }

        this.outputCallback(outputData)
        this.copyOutputToMatrix(outputData)
        const elapsedMs = performance.now() - startTime
        const minIntervalMs = 1000 / this.fpsLimit
        const delayMs = Math.max(0, minIntervalMs - elapsedMs)
        setTimeout(() => {
          if (!this.isPaused) {
            this.iterate()
          }
        }, delayMs)
      })
      .catch(e => {
        this.logger.error('Inference failed', {
          error: e instanceof Error ? e.message : String(e),
        })
        this.isPaused = true
      })
  }

  private normalizeMatrix(matrix: Float32Array): void {
    this.logger.debug('Normalizing matrix channels')
    for (let i = 0; i < this.channelSize; i++) {
      matrix = this.normalizeMatrixChannel(matrix, i)
    }
  }

  private normalizeMatrixChannel(
    matrix: Float32Array,
    channel: number,
  ): Float32Array {
    const sum = this.matrixSum(matrix, [channel, channel + 1], value => value)
    const mean = this.roundFloat(
      sum / (this.gridSize[0] * this.gridSize[1] * this.batchSize),
      4,
    )
    const std = this.roundFloat(
      Math.sqrt(
        this.matrixSum(
          matrix,
          [channel, channel + 1],
          value => (value - mean) ** 2,
        ) /
          (this.gridSize[0] * this.gridSize[1] * this.batchSize),
      ),
      4,
    )
    this.logger.debug('Normalized channel', { channel, mean, std })
    const safeStd = std === 0 ? 1 : std
    return this.matrixMap(
      matrix,
      [channel, channel + 1],
      value => (value - mean) / safeStd,
    )
  }

  private constrainOutput(
    data: Float32Array,
    inputEnergy: number,
  ): Float32Array {
    let processed = this.constrainDensity(data)
    processed = this.constrainVelocity(processed, inputEnergy)
    return processed
  }

  // data has cut off negative values (argument changed!)
  private constrainDensity(data: Float32Array): Float32Array {
    data = this.matrixMap(data, [0, 1], value => Math.max(value, 0), true)
    const sum = this.matrixSum(data, [0, 1], value => value, true)
    if (!Number.isFinite(sum) || sum <= EPS) {
      this.logger.warn('Density sum too small, skip scaling', { sum })
      return data
    }
    let scale = this.mass / sum
    if (!Number.isFinite(scale) || scale <= 0) return data
    scale = Math.min(scale, MAX_DENSITY_SCALE)
    this.logger.debug('Scaling density', {
      currentMass: sum,
      targetMass: this.mass,
      scale,
    })
    return this.matrixMap(data, [0, 1], value => value * scale, true)
  }

  private constrainVelocity(
    data: Float32Array,
    inputEnergy: number,
  ): Float32Array {
    const curEnergy = this.matrixSum(data, [1, 3], value => value ** 2, true)
    if (
      !Number.isFinite(inputEnergy) ||
      inputEnergy <= EPS ||
      !Number.isFinite(curEnergy) ||
      curEnergy <= EPS
    ) {
      return data
    }
    const scale = this.roundFloat(Math.sqrt(inputEnergy / curEnergy), 4)
    this.logger.debug('Scaling velocity', {
      currentEnergy: curEnergy,
      targetEnergy: inputEnergy,
      scale,
    })
    if (scale >= 1) return data
    return this.matrixMap(data, [1, 3], value => value * scale, true)
  }

  private copyOutputToMatrix(outputs: Float32Array): void {
    if (this.matrixArray.length === 0) {
      throw new Error('matrixArray is empty')
    }
    let fromIndex = 0
    let toIndex = 0
    let cntOffset = 0
    while (fromIndex < outputs.length) {
      if (cntOffset >= 3) {
        cntOffset = 0
        toIndex += 2
        if (toIndex >= this.matrixArray.length) {
          throw new Error(
            `toIndex ${toIndex} exceeds matrixArray length ${this.matrixArray.length}`,
          )
        }
      }
      this.matrixArray[toIndex] = outputs[fromIndex]
      fromIndex++
      toIndex++
      cntOffset++
    }
    if (fromIndex !== outputs.length) {
      throw new Error(
        `fromIndex ${fromIndex} does not match outputs length ${outputs.length}`,
      )
    }
    if (toIndex + 2 !== this.matrixArray.length) {
      throw new Error(
        `toIndex ${toIndex} does not match matrixArray length ${this.matrixArray.length}`,
      )
    }
  }

  updateForce(pos: Vector2, forceDelta: Vector2): void {
    const index: number = this.getIndex(pos)
    this.matrixArray[index + 3] += forceDelta.x
    this.matrixArray[index + 4] += forceDelta.y
  }

  private getIndex(pos: Vector2, batchIndex = 0): number {
    return (
      batchIndex * this.gridSize[0] * this.gridSize[1] * this.channelSize +
      pos.y * this.gridSize[1] * this.channelSize +
      pos.x * this.channelSize
    )
  }

  /**
   * Calculate the sum of a matrix Array with provided transform applied on matrix values.
   * @param matrix input matrix Array
   * @param channelRange range of selected channel
   * @param f transform function for matrix values
   * @param isOutput is the matrix from model output
   * @returns sum of the selected channel of matrix
   */
  private matrixSum(
    matrix: Float32Array,
    channelRange: [number, number],
    f: (value: number) => number = value => value,
    isOutput = false,
  ): number {
    const tensorSize = isOutput ? this.outputSize : this.tensorSize
    const channelSize = isOutput ? this.outputChannelSize : this.channelSize
    let sum = 0
    let index = 0
    while (index < tensorSize) {
      for (let k = channelRange[0]; k < channelRange[1]; k++) {
        sum += f(matrix[index + k])
      }
      index += channelSize
    }
    return sum
  }

  /**
   * Map the transform function to selected channel of input matrix.
   * @param matrix input matrix Array
   * @param channelRange range of selected channel
   * @param f transform function for matrix values
   * @param isOutput is the matrix from model output
   * @returns sum of the selected channel of matrix
   */
  private matrixMap(
    matrix: Float32Array,
    channelRange: [number, number],
    f: (value: number) => number,
    isOutput = false,
  ): Float32Array {
    const tensorSize = isOutput ? this.outputSize : this.tensorSize
    const channelSize = isOutput ? this.outputChannelSize : this.channelSize
    let index = 0
    while (index < tensorSize) {
      for (let k = channelRange[0]; k < channelRange[1]; k++) {
        matrix[index + k] = f(matrix[index + k])
      }
      index += channelSize
    }
    return matrix
  }

  private roundFloat(value: number, decimal = 4): number {
    return Math.round(value * 10 ** decimal) / 10 ** decimal
  }

  getInputTensor(): Float32Array {
    return this.matrixArray
  }

  getMass(): number {
    return this.mass
  }

  getInputShape(): [number, number, number, number] {
    return this.tensorShape
  }

  setMass(mass: number): void {
    this.mass = mass
  }

  getType(): string {
    return 'onnx'
  }
}
