/**
 * Utility for resolving asset URLs based on environment.
 *
 * In development, assets are served from root / (Vite serves public/ at /)
 * In production, assets are loaded from GitHub raw content to reduce bundle size.
 */

const DEFAULT_BASE_URL = '/'

/**
 * Get the asset prefix from environment variable.
 * Falls back to root / if not configured.
 */
function getAssetPrefix(): string {
  // VITE_ prefixed env variables are available at import.meta.env in Vite
  return import.meta.env.VITE_ASSET_PREFIX || DEFAULT_BASE_URL
}

/**
 * Resolve a relative asset path to a full URL based on the environment.
 *
 * @param relativePath - Relative path starting with / (e.g., '/model/file.onnx')
 * @returns Full URL for the asset (local or remote)
 *
 * @example
 * ```ts
 * // Development: returns '/model/file.onnx'
 * // Production: returns 'https://raw.githubusercontent.com/user/repo/main/public/model/file.onnx'
 * resolveAssetPath('/model/file.onnx')
 * ```
 */
export function resolveAssetPath(relativePath: string): string {
  const prefix = getAssetPrefix()

  // Remove leading slash from relativePath if present
  const cleanPath = relativePath.startsWith('/')
    ? relativePath.slice(1)
    : relativePath

  // Remove trailing slash from prefix if present
  const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`

  return `${cleanPrefix}${cleanPath}`
}

/**
 * Get the current asset prefix (useful for debugging/display).
 */
export function getAssetPrefixValue(): string {
  return getAssetPrefix()
}
