import { resolveAssetPath } from '@/utils/assetUrl'
import { createLogger } from '@/utils/logger'

const logger = createLogger('initDataService')

const CONFIG_PATH = '/initData/index.json'

export interface InitDataItem {
  id: string
  path: string
  name: string
}

export interface InitDataCategory {
  id: string
  name: string
  items: InitDataItem[]
}

export interface InitDataConfig {
  categories: InitDataCategory[]
}

let cachedConfig: InitDataConfig | null = null

export async function loadInitDataConfig(): Promise<InitDataConfig> {
  if (cachedConfig) {
    return cachedConfig
  }

  try {
    const configPath = resolveAssetPath(CONFIG_PATH)
    logger.debug('Loading initData config from', { path: configPath })

    const response = await fetch(configPath)
    if (!response.ok) {
      throw new Error(`Failed to load initData config: ${response.statusText}`)
    }

    const config = (await response.json()) as InitDataConfig
    cachedConfig = config
    logger.debug('Loaded initData config', {
      categories: config.categories.length,
    })
    return config
  } catch (error) {
    logger.error('Failed to load initData config', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export function findInitDataItem(
  config: InitDataConfig,
  categoryId: string,
  itemId: string,
): InitDataItem | undefined {
  const category = config.categories.find(cat => cat.id === categoryId)
  if (!category) return undefined
  return category.items.find(item => item.id === itemId)
}

export function parseInitStateId(initStateId: string): {
  categoryId: string
  itemId: string
} | null {
  const parts = initStateId.split(':')
  if (parts.length !== 2) return null
  const [categoryId, itemId] = parts
  return { categoryId, itemId }
}

export function formatInitStateId(categoryId: string, itemId: string): string {
  return `${categoryId}:${itemId}`
}
