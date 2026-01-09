import * as tf from '@tensorflow/tfjs'
import type { Vector2 } from 'three'
import type { ModelService } from './modelService'
import '@tensorflow/tfjs-backend-webgpu'
import { RegressionMonitor } from '@/services/regression/regressionMonitor'
import { createLogger } from '@/utils/logger'
import type { ModelNormalization } from './modelMeta'

// Use a const that gets replaced by Vite at build time
declare const __DEV__: boolean
const IS_DEV: boolean = __DEV__
const EPS = 1e-6
const MAX_DENSITY_SCALE = 10

export class TfjsService implements ModelService {
  private logger = createLogger('TfjsService')
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
  private normScale: {
    density: number
    velocity: number
    forceX: number
    forceY: number
  } | null = null

  isPaused: boolean
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
  }

  static async createService(
    modelPath: string,
    gridSize: [number, number] = [64, 64],
    batchSize = 1,
    channelSize = 5,
    outputChannelSize = 3,
    fpsLimit = 15,
    backend = 'webgl',
    normalization: ModelNormalization | null = null,
  ): Promise<TfjsService> {
    await tf.setBackend(backend)
    const service = new TfjsService()
    service.model = await tf.loadGraphModel(modelPath)

    service.gridSize = gridSize
    service.batchSize = batchSize
    service.channelSize = channelSize
    service.outputChannelSize = outputChannelSize
    service.fpsLimit = fpsLimit
    service.setNormalization(normalization)
    return service
  }

  loadDataArray(
    array: number[][][][],
    options?: { normalized?: boolean },
  ): void {
    this.logger.debug('Loading data array', {
      shape: `${array.length}x${array[0]?.length}x${array[0]?.[0]?.length}x${array[0]?.[0]?.[0]?.length}`,
    })
    const arrayTensor = tf.tensor4d(
      array,
      [this.batchSize, ...this.gridSize, this.channelSize],
      'float32',
    )
    const disposeIfDifferent = (value: tf.Tensor, source: tf.Tensor) => {
      if (value !== source) value.dispose()
    }
    // 0: partial density
    // 1, 2: partial velocity
    // 3, 4: Pressure
    const density = arrayTensor.slice(
      [0, 0, 0, 0],
      [this.batchSize, ...this.gridSize, 1],
    )
    const normalizedDensity = options?.normalized
      ? density
      : this.normalizeTensor(density, 'density')
    const clampedDensity = normalizedDensity.maximum(0)
    this.density = tf.variable(clampedDensity)
    clampedDensity.dispose()
    disposeIfDifferent(normalizedDensity, density)
    density.dispose()
    const velocityX = arrayTensor.slice(
      [0, 0, 0, 1],
      [this.batchSize, ...this.gridSize, 1],
    )
    const velocityY = arrayTensor.slice(
      [0, 0, 0, 2],
      [this.batchSize, ...this.gridSize, 1],
    )
    const normalizedVelocityX = options?.normalized
      ? velocityX
      : this.normalizeTensor(velocityX, 'velocity')
    const normalizedVelocityY = options?.normalized
      ? velocityY
      : this.normalizeTensor(velocityY, 'velocity')
    this.velocity = tf.variable(
      tf.concat([normalizedVelocityX, normalizedVelocityY], 3),
    ) as tf.Variable<tf.Rank.R4>
    disposeIfDifferent(normalizedVelocityX, velocityX)
    disposeIfDifferent(normalizedVelocityY, velocityY)
    velocityX.dispose()
    velocityY.dispose()
    const pressureX = arrayTensor.slice(
      [0, 0, 0, 3],
      [this.batchSize, ...this.gridSize, 1],
    )
    const pressureY = arrayTensor.slice(
      [0, 0, 0, 4],
      [this.batchSize, ...this.gridSize, 1],
    )
    const normalizedPressureX = options?.normalized
      ? pressureX
      : this.normalizeTensor(pressureX, 'forceX')
    const normalizedPressureY = options?.normalized
      ? pressureY
      : this.normalizeTensor(pressureY, 'forceY')
    this.pressure = tf
      .concat([normalizedPressureX, normalizedPressureY], 3)
      .bufferSync() as tf.TensorBuffer<tf.Rank.R4>
    disposeIfDifferent(normalizedPressureX, pressureX)
    disposeIfDifferent(normalizedPressureY, pressureY)
    pressureX.dispose()
    pressureY.dispose()
    this.density.assign(this.density.maximum(0))
    this.mass = this.density.sum()
    this.logger.debug('Mass calculated', { mass: this.mass.dataSync()[0] })
  }

  private normalizeTensor(
    tensor: tf.Tensor,
    channel: 'density' | 'velocity' | 'forceX' | 'forceY',
  ): tf.Tensor {
    if (!this.normScale) {
      return tf.tidy(() => {
        const { mean, variance } = tf.moments(tensor)
        const epsilon = tf.scalar(EPS)
        return tensor.sub(mean).div(variance.add(epsilon).sqrt())
      })
    }
    const scale = this.normScale[channel]
    if (scale === 1) return tensor
    return tensor.mul(scale)
  }

  pauseSimulation(): void {
    this.isPaused = true
  }

  bindOutput(callback: (data: Float32Array) => void): void {
    this.outputCallback = callback
  }

  startSimulation(): void {
    this.isPaused = false
    this.iterate()
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
      tf.tidy(() => {
        const energyScale = energy.div(newEnergy)
        const energyScaleCapped = tf.minimum(energyScale, tf.scalar(1))
        const energyValue = energyScaleCapped.dataSync()[0]
        this.logger.debug('Energy scale', { energyScale: energyValue })
        this.velocity.assign(this.velocity.mul(energyScaleCapped.sqrt()))
      })
      const newMass = this.density.sum()
      tf.tidy(() => {
        const massScale = this.mass.div(tf.maximum(newMass, tf.scalar(EPS)))
        const massScaleCapped = tf.minimum(
          massScale,
          tf.scalar(MAX_DENSITY_SCALE),
        )
        this.density.assign(this.density.mul(massScaleCapped))
        const massValue = massScaleCapped.dataSync()[0]
        this.logger.debug('Mass scale', { massScale: massValue })
      })
      newMass.dispose()
      newEnergy.dispose()
      energy.dispose()

      // Regression monitoring (dev only)
      if (IS_DEV) {
        const inferenceTime = performance.now() - startTime

        this.frameNumber++
        if (this.frameNumber % this.monitorSampleInterval === 0) {
          // Extract density and velocity as Float32Array
          const densityData = this.density.dataSync() as Float32Array
          const velocityData = this.velocity.dataSync() as Float32Array

          // Velocity is stored as [vx, vy] interleaved, need to separate
          const n = velocityData.length / 2
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
          const densityCount = Math.min(densityData.length, n)
          density.set(densityData.subarray(0, densityCount))
          if (densityCount < n) {
            density.fill(0, densityCount)
          }
          for (let i = 0; i < n; i++) {
            velocityX[i] = velocityData[i * 2]
            velocityY[i] = velocityData[i * 2 + 1]
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

      this.outputCallback(output?.dataSync() as Float32Array)
      output.dispose()
      const elapsedMs = performance.now() - startTime
      const minIntervalMs = 1000 / this.fpsLimit
      const delayMs = Math.max(0, minIntervalMs - elapsedMs)
      setTimeout(() => {
        this.iterate()
      }, delayMs)
    })
  }

  updateForce(pos: Vector2, forceDelta: Vector2, batchIndex = 0): void {
    const scale = this.normScale
    const forceX = scale ? forceDelta.x * scale.forceX : forceDelta.x
    const forceY = scale ? forceDelta.y * scale.forceY : forceDelta.y
    this.pressure.set(
      this.pressure.get(batchIndex, pos.x, pos.y, 0) + forceX,
      batchIndex,
      pos.x,
      pos.y,
      3,
    )
    this.pressure.set(
      this.pressure.get(batchIndex, pos.x, pos.y, 1) + forceY,
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

  private setNormalization(normalization: ModelNormalization | null): void {
    if (!normalization) {
      this.normScale = null
      return
    }
    const safeInv = (value: number) => (value > 0 ? 1 / value : 1)
    const forceAlpha = normalization.forceScaleAlpha ?? 1
    this.normScale = {
      density: safeInv(normalization.densitySd),
      velocity: safeInv(normalization.velocitySd),
      forceX: safeInv(normalization.forceSd[0]) * forceAlpha,
      forceY: safeInv(normalization.forceSd[1]),
    }
  }
}
