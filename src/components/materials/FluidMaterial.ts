import * as THREE from 'three'
import { clamp, mix, texture as textureNode, uniform, vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'

/**
 * Configuration for creating a fluid visualization material
 */
export interface FluidMaterialConfig {
  /** The density texture containing simulation data (64x64) */
  densityTexture: THREE.DataTexture
  /** Color for low density values */
  lowColor: THREE.Color
  /** Color for high density values */
  highColor: THREE.Color
  /** Scale factor for height displacement */
  heightScale: number
  /** Whether to enable height map rendering */
  enableHeightMap: boolean
}

/**
 * Creates a TSL-based fluid visualization material
 * This material works with both WebGLRenderer and WebGPURenderer
 *
 * @param config - Material configuration
 * @returns A MeshBasicNodeMaterial with fluid visualization
 */
export function createFluidMaterial(
  config: FluidMaterialConfig,
): InstanceType<typeof MeshBasicNodeMaterial> {
  const material = new MeshBasicNodeMaterial() as InstanceType<
    typeof MeshBasicNodeMaterial
  > & {
    // biome-ignore lint/suspicious/noExplicitAny: TSL node types not exported by three/tsl
    colorNode?: any
    // biome-ignore lint/suspicious/noExplicitAny: TSL node types not exported by three/tsl
    positionNode?: any
  }

  // Create TSL uniforms
  const lowColorUniform = uniform(
    vec3(config.lowColor.r, config.lowColor.g, config.lowColor.b),
  )
  const highColorUniform = uniform(
    vec3(config.highColor.r, config.highColor.g, config.highColor.b),
  )
  const heightScaleUniform = uniform(config.heightScale)

  // Sample density texture at UV coordinates
  // Use texture() directly on the texture object instead of wrapping in uniform
  const densityValue = textureNode(config.densityTexture).r

  // Vertex displacement for height map rendering
  // This modifies the vertex position based on density
  if (config.enableHeightMap) {
    material.positionNode = densityValue.mul(heightScaleUniform)
  }

  // Fragment color: interpolate between low and high colors based on density
  const normalizedDensity = clamp(densityValue, 0.0, 1.0)
  material.colorNode = mix(lowColorUniform, highColorUniform, normalizedDensity)

  return material
}

/**
 * Creates a reusable density texture for fluid simulation
 * The texture is pre-allocated and can be updated without creating new objects
 *
 * @returns A DataTexture configured for density data (64x64, R32F)
 */
export function createDensityTexture(): THREE.DataTexture {
  const data = new Float32Array(64 * 64)
  const tex = new THREE.DataTexture(
    data,
    64,
    64,
    THREE.RedFormat,
    THREE.FloatType,
  )
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/**
 * Updates a density texture with new data
 * This function updates the texture in-place without creating a new object,
 * avoiding GC pressure and improving performance
 *
 * @param texture - The texture to update (created by createDensityTexture)
 * @param data - The new density data (4096 float values)
 * @param rangeHigh - Maximum density value for normalization (default: 10.0)
 * @param rangeLow - Minimum density value for normalization (default: 0.0)
 */
export function updateDensityTexture(
  texture: THREE.DataTexture,
  data: Float32Array,
  rangeHigh: number = 10.0,
  rangeLow: number = 0.0,
): void {
  const rangeSize = rangeHigh - rangeLow

  // Normalize density values in-place
  // TODO: Replace with GPU compute shader for WebGPU in future
  for (let i = 0; i < data.length; i++) {
    let density = Math.min(data[i] as number, rangeHigh)
    density = Math.max(density, rangeLow)
    data[i] = density / rangeSize
  }

  // Update texture data without creating new object
  // This is the key optimization: reuse the same texture
  if (texture.image.data) {
    texture.image.data.set(data)
  }
  texture.needsUpdate = true
}
