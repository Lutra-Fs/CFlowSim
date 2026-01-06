// Statistical collector for physical properties from simulation state

// Logger interface for regression monitoring
type Logger = Pick<Console, 'error' | 'warn' | 'log' | 'info'>

// Use a const that gets replaced by Vite at build time
declare const __DEV__: boolean
const ENABLED: boolean = __DEV__

export const StatisticsCollector = {
  collect(
    density: Float32Array,
    velocityX: Float32Array,
    velocityY: Float32Array,
  ): {
    mass: number
    energy: number
    hasNaN: boolean
    hasInf: boolean
    negativeDensity: boolean
  } {
    let mass = 0
    let energy = 0
    let hasNaN = false
    let hasInf = false
    let negativeDensity = false

    const n = density.length
    for (let i = 0; i < n; i++) {
      const d = density[i]
      const vx = velocityX[i]
      const vy = velocityY[i]

      if (Number.isNaN(d) || Number.isNaN(vx) || Number.isNaN(vy)) hasNaN = true
      if (!Number.isFinite(d) || !Number.isFinite(vx) || !Number.isFinite(vy))
        hasInf = true
      if (d < 0) negativeDensity = true

      mass += d
      energy += vx * vx + vy * vy
    }

    return { mass, energy, hasNaN, hasInf, negativeDensity }
  },
}

// SPC monitor: Statistical Process Control for anomaly detection
export class SPCMonitor {
  private massValues: number[] = []
  private energyValues: number[] = []
  private readonly baselineSize = 100
  private readonly sigmaThreshold = 3

  // Collect baseline or detect anomalies
  check(
    mass: number,
    energy: number,
  ): { massDrift?: boolean; energyDrift?: boolean } {
    // Collect baseline
    if (this.massValues.length < this.baselineSize) {
      this.massValues.push(mass)
      this.energyValues.push(energy)
      return {}
    }

    // Calculate baseline statistics
    const massMean =
      this.massValues.reduce((a, b) => a + b) / this.massValues.length
    const massStd = Math.sqrt(
      this.massValues.reduce((sum, m) => sum + (m - massMean) ** 2, 0) /
        this.massValues.length,
    )

    const energyMean =
      this.energyValues.reduce((a, b) => a + b) / this.energyValues.length
    const energyStd = Math.sqrt(
      this.energyValues.reduce((sum, e) => sum + (e - energyMean) ** 2, 0) /
        this.energyValues.length,
    )

    // Calculate z-score
    const massZ = massStd === 0 ? 0 : (mass - massMean) / massStd
    const energyZ = energyStd === 0 ? 0 : (energy - energyMean) / energyStd

    return {
      massDrift: Math.abs(massZ) > this.sigmaThreshold,
      energyDrift: Math.abs(energyZ) > this.sigmaThreshold,
    }
  }

  getBaselineStats(): { massMean: number; energyMean: number } | null {
    if (this.massValues.length === 0) return null
    const massMean =
      this.massValues.reduce((a, b) => a + b) / this.massValues.length
    const energyMean =
      this.energyValues.reduce((a, b) => a + b) / this.energyValues.length
    return { massMean, energyMean }
  }

  reset(): void {
    this.massValues = []
    this.energyValues = []
  }
}

// Performance monitor for regression detection
export class PerformanceMonitor {
  private baselineTime = 0
  private recentTimes: number[] = []
  private frameCount = 0

  record(inferenceTimeMs: number): { regression?: boolean } {
    this.frameCount++

    if (this.frameCount <= 50) {
      this.baselineTime += inferenceTimeMs
      return {}
    } else if (this.frameCount === 51) {
      this.baselineTime /= 50
      return {}
    } else {
      this.recentTimes.push(inferenceTimeMs)
      if (this.recentTimes.length > 30) this.recentTimes.shift()

      const avgRecent =
        this.recentTimes.reduce((a, b) => a + b) / this.recentTimes.length
      const degradation = (avgRecent - this.baselineTime) / this.baselineTime

      return { regression: degradation > 0.2 }
    }
  }

  reset(): void {
    this.baselineTime = 0
    this.recentTimes = []
    this.frameCount = 0
  }
}

// Main regression monitor integrating SPC and performance tracking
export class RegressionMonitor {
  private spc = new SPCMonitor()
  private perf = new PerformanceMonitor()

  monitorFrame(
    density: Float32Array,
    velocityX: Float32Array,
    velocityY: Float32Array,
    inferenceTimeMs: number,
    logger: Logger,
  ): void {
    if (!ENABLED) return

    // 1. Collect statistics
    const stats = StatisticsCollector.collect(density, velocityX, velocityY)

    // 2. Immediate numerical checks
    if (stats.hasNaN || stats.hasInf) {
      logger.error(
        `Numerical instability! NaN=${stats.hasNaN}, Inf=${stats.hasInf}`,
      )
    }
    if (stats.negativeDensity) {
      logger.warn('Negative density detected')
    }

    // 3. SPC detection
    const spcResult = this.spc.check(stats.mass, stats.energy)
    const baseline = this.spc.getBaselineStats()

    if (spcResult.massDrift && baseline) {
      logger.warn(
        `Mass drift detected: ${stats.mass.toFixed(2)} (baseline: ${baseline.massMean.toFixed(2)})`,
      )
    }
    if (spcResult.energyDrift && baseline) {
      logger.warn(
        `Energy drift detected: ${stats.energy.toFixed(2)} (baseline: ${baseline.energyMean.toFixed(2)})`,
      )
    }

    // 4. Performance monitoring
    const perfResult = this.perf.record(inferenceTimeMs)
    if (perfResult.regression) {
      logger.warn('Performance regression detected (>20% slower)')
    }
  }

  reset(): void {
    this.spc.reset()
    this.perf.reset()
  }
}
