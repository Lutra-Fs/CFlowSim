import * as tf from '@tensorflow/tfjs'
import type { Vector2 } from 'three'
import type { ModelService } from './modelService'
import '@tensorflow/tfjs-backend-webgpu'
import { RegressionMonitor } from '@/services/regression/regressionMonitor'
import { createLogger } from '@/utils/logger'

// Use a const that gets replaced by Vite at build time
declare const __DEV__: boolean
const IS_DEV: boolean = __DEV__

export class TfjsService implements ModelService {
  private logger = createLogger('TfjsService')
  private monitor = IS_DEV
    ? new RegressionMonitor()
    : (null as unknown as RegressionMonitor)
  private frameNumber = 0
  model!: tf.GraphModel
  gridSize: [number, number]
  batchSize: number
  channelSize: number
  outputChannelSize: number
  mass!: tf.Tensor
  fpsLimit: number
  density!: tf.Variable<tf.Rank.R4>
  velocity!: tf.Variable<tf.Rank.R4>
  pressure!: tf.TensorBuffer<tf.Rank.R4>

  isPaused: boolean
  curFrameCountbyLastSecond: number
  private outputCallback!: (data: Float32Array) => void

  constructor() {
    this.density = tf.variable(tf.zeros([0, 0, 0, 0]))
    this.velocity = tf.variable(tf.zeros([0, 0, 0, 0]))
    this.pressure = tf.buffer([0, 0, 0, 0])
    this.mass = tf.variable(tf.zeros([0]))
    this.gridSize = [0, 0]
    this.batchSize = 0
    this.isPaused = true
    this.channelSize = 0
    this.outputChannelSize = 0
    this.fpsLimit = 30
    this.curFrameCountbyLastSecond = 0
  }

  static async createService(
    modelPath: string,
    gridSize: [number, number] = [64, 64],
    batchSize = 1,
    channelSize = 5,
    outputChannelSize = 3,
    fpsLimit = 15,
    backend = 'webgl',
  ): Promise<TfjsService> {
    await tf.setBackend(backend)
    const service = new TfjsService()
    service.model = await tf.loadGraphModel(modelPath)

    service.gridSize = gridSize
    service.batchSize = batchSize
    service.channelSize = channelSize
    service.outputChannelSize = outputChannelSize
    service.fpsLimit = fpsLimit
    return service
  }

  loadDataArray(array: number[][][][]): void {
    this.logger.debug('Loading data array', {
      shape: `${array.length}x${array[0]?.length}x${array[0]?.[0]?.length}x${array[0]?.[0]?.[0]?.length}`,
    })
    const arrayTensor = tf.tensor4d(
      array,
      [this.batchSize, ...this.gridSize, this.channelSize],
      'float32',
    )
    // 0: partial density
    // 1, 2: partial velocity
    // 3, 4: Pressure
    const density = arrayTensor.slice(
      [0, 0, 0, 0],
      [this.batchSize, ...this.gridSize, 1],
    )
    const normalizedDensity = TfjsService.normalizeTensor(density)
    density.dispose()
    this.density = tf.variable(normalizedDensity.maximum(0))
    const velocityX = arrayTensor.slice(
      [0, 0, 0, 1],
      [this.batchSize, ...this.gridSize, 1],
    )
    const velocityY = arrayTensor.slice(
      [0, 0, 0, 2],
      [this.batchSize, ...this.gridSize, 1],
    )
    const normalizedVelocityX = TfjsService.normalizeTensor(velocityX)
    const normalizedVelocityY = TfjsService.normalizeTensor(velocityY)
    velocityX.dispose()
    velocityY.dispose()
    this.velocity = tf.variable(
      tf.concat([normalizedVelocityX, normalizedVelocityY], 3),
    ) as tf.Variable<tf.Rank.R4>
    normalizedVelocityX.dispose()
    normalizedVelocityY.dispose()
    const pressureX = arrayTensor.slice(
      [0, 0, 0, 3],
      [this.batchSize, ...this.gridSize, 1],
    )
    const pressureY = arrayTensor.slice(
      [0, 0, 0, 4],
      [this.batchSize, ...this.gridSize, 1],
    )
    const normalizedPressureX = TfjsService.normalizeTensor(pressureX)
    const normalizedPressureY = TfjsService.normalizeTensor(pressureY)
    pressureX.dispose()
    pressureY.dispose()
    this.pressure = tf
      .concat([normalizedPressureX, normalizedPressureY], 3)
      .bufferSync() as tf.TensorBuffer<tf.Rank.R4>
    normalizedPressureX.dispose()
    this.density.assign(this.density.maximum(0))
    this.mass = this.density.sum()
    this.logger.debug('Mass calculated', { mass: this.mass.dataSync()[0] })
  }

  static normalizeTensor(tensor: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const { mean, variance } = tf.moments(tensor)
      return tensor.sub(mean).div(variance.sqrt())
    })
  }

  pauseSimulation(): void {
    this.isPaused = true
  }

  bindOutput(callback: (data: Float32Array) => void): void {
    this.outputCallback = callback
  }

  startSimulation(): void {
    this.isPaused = false
    this.curFrameCountbyLastSecond = 0
    this.fpsHeartbeat()
    this.iterate()
  }

  private fpsHeartbeat(): void {
    setTimeout(() => {
      this.curFrameCountbyLastSecond = 0
      if (this.curFrameCountbyLastSecond >= this.fpsLimit) {
        this.startSimulation()
      } else {
        this.fpsHeartbeat()
      }
    }, 1000)
  }

  getInput(): tf.Tensor<tf.Rank> {
    const pressure = this.pressure.toTensor()
    const input = tf.concat([this.density, this.velocity, pressure], 3)
    pressure.dispose()
    return input
  }

  private iterate(): void {
    if (this.isPaused) {
      return
    }
    this.curFrameCountbyLastSecond += 1
    const input = this.getInput()
    const startTime = performance.now()
    const energy = this.velocity.square().sum()
    // const output = this.model?.predict(input);
    void this.model?.predictAsync(input).then(a => {
      const output = a as tf.Tensor<tf.Rank>
      // update density, velocity
      this.density.assign(
        output?.slice(
          [0, 0, 0, 0],
          [this.batchSize, ...this.gridSize, 1],
        ) as tf.Tensor4D,
      )
      this.velocity.assign(
        output?.slice(
          [0, 0, 0, 1],
          [this.batchSize, ...this.gridSize, 2],
        ) as tf.Tensor4D,
      )
      // update density, velocity
      const newEnergy = this.velocity.square().sum()
      const energyScale = energy.div(newEnergy)
      const energyValue = energyScale.dataSync()[0]
      this.logger.debug('Energy scale', { energyScale: energyValue })

      this.velocity.assign(this.velocity.mul(energyScale.sqrt()))
      const newMass = this.density.sum()
      const massScale = this.mass.div(newMass)
      this.density.assign(this.density.mul(massScale))
      const massValue = massScale.dataSync()[0]
      this.logger.debug('Mass scale', { massScale: massValue })
      newMass.dispose()
      newEnergy.dispose()
      energy.dispose()
      energyScale.dispose()

      // Regression monitoring (dev only)
      if (IS_DEV) {
        const inferenceTime = performance.now() - startTime

        // Extract density and velocity as Float32Array
        const densityData = this.density.dataSync() as Float32Array
        const velocityData = this.velocity.dataSync() as Float32Array

        // Velocity is stored as [vx, vy] interleaved, need to separate
        const n = densityData.length / 2 // velocity has 2 channels per cell
        const velocityX = new Float32Array(n)
        const velocityY = new Float32Array(n)

        for (let i = 0; i < n; i++) {
          velocityX[i] = velocityData[i * 2]
          velocityY[i] = velocityData[i * 2 + 1]
        }

        // Use only first n/2 density values to match velocity size
        const density = densityData.slice(0, n)

        this.frameNumber++
        this.monitor.monitorFrame(
          density,
          velocityX,
          velocityY,
          inferenceTime,
          this.logger,
        )
      }

      this.outputCallback(output?.dataSync() as Float32Array)
      output.dispose()
      // set timeout to 0 to allow other tasks to run, like pause and apply force
      setTimeout(() => {
        this.curFrameCountbyLastSecond += 1
        this.logger.debug('Frame count', {
          count: this.curFrameCountbyLastSecond,
        })
        this.iterate()
      }, 0)
    })
  }

  updateForce(pos: Vector2, forceDelta: Vector2, batchIndex = 0): void {
    this.pressure.set(
      this.pressure.get(batchIndex, pos.x, pos.y, 0) + forceDelta.x,
      batchIndex,
      pos.x,
      pos.y,
      3,
    )
    this.pressure.set(
      this.pressure.get(batchIndex, pos.x, pos.y, 1) + forceDelta.y,
      batchIndex,
      pos.x,
      pos.y,
      4,
    )
  }

  getInputTensor(): Float32Array {
    const input = this.getInput()
    const data = input.dataSync()
    input.dispose()
    return data as Float32Array
  }

  getMass(): number {
    return this.mass.dataSync()[0]
  }

  getInputShape(): [number, number, number, number] {
    return [this.batchSize, ...this.gridSize, this.channelSize]
  }

  setMass(mass: number): void {
    this.mass.dispose()
    this.mass = tf.scalar(mass)
  }

  dispose(): void {
    this.density.dispose()
    this.velocity.dispose()
    this.model.dispose()
  }

  getType(): string {
    return 'tfjs'
  }
}
