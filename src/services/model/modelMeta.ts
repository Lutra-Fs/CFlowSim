import { createLogger } from '@/utils/logger'

const logger = createLogger('modelMeta')

export type ModelNormalization = {
  densitySd: number
  velocitySd: number
  forceSd: [number, number]
  forceScaleAlpha?: number
}

export type ModelMeta = {
  version: 1
  channels: {
    density: number
    velocity: [number, number]
    force: [number, number]
  }
  normalization: ModelNormalization
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isNormalization(value: unknown): value is ModelNormalization {
  if (value == null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (!isPositiveNumber(record.densitySd)) return false
  if (!isPositiveNumber(record.velocitySd)) return false
  if (!Array.isArray(record.forceSd) || record.forceSd.length !== 2)
    return false
  const [fx, fy] = record.forceSd
  if (!isPositiveNumber(fx) || !isPositiveNumber(fy)) return false
  if (
    record.forceScaleAlpha != null &&
    !isPositiveNumber(record.forceScaleAlpha)
  ) {
    return false
  }
  return true
}

function isChannelMapping(value: unknown): value is ModelMeta['channels'] {
  if (value == null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.density !== 0) return false
  if (!Array.isArray(record.velocity) || record.velocity.length !== 2)
    return false
  if (!Array.isArray(record.force) || record.force.length !== 2) return false
  return (
    record.velocity[0] === 1 &&
    record.velocity[1] === 2 &&
    record.force[0] === 3 &&
    record.force[1] === 4
  )
}

function isModelMeta(value: unknown): value is ModelMeta {
  if (value == null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.version !== 1) return false
  if (!isChannelMapping(record.channels)) return false
  if (!isNormalization(record.normalization)) return false
  return true
}

function toMetaPath(modelPath: string): string | null {
  const dotIndex = modelPath.lastIndexOf('.')
  if (dotIndex === -1) return null
  return `${modelPath.slice(0, dotIndex)}.meta.json`
}

export async function loadModelMeta(
  modelPath: string,
): Promise<ModelMeta | null> {
  if (typeof fetch !== 'function') {
    return null
  }
  const metaPath = toMetaPath(modelPath)
  if (!metaPath) return null
  try {
    const response = await fetch(metaPath)
    if (!response.ok) return null
    const meta = (await response.json()) as unknown
    if (!isModelMeta(meta)) {
      logger.warn('Invalid model meta, ignoring', { metaPath })
      return null
    }
    return meta
  } catch (error) {
    logger.warn('Failed to load model meta', {
      metaPath,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
