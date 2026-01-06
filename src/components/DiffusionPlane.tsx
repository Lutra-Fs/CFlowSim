import { OrbitControls } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame, useThree } from '@react-three/fiber'
import { type JSX, useEffect, useMemo, useRef } from 'react'
import * as t from 'three'
import {
  clamp,
  mix,
  positionLocal,
  texture as textureNode,
  uniform,
  vec3,
} from 'three/tsl'
import { RunnerFunc, type UpdateForceArgs } from '../workers/modelWorkerMessage'
import {
  createDensityTexture,
  updateDensityTexture,
} from './materials/FluidMaterial'

/**
 * Props for DiffusionPlane component
 */
interface DiffusionPlaneProps {
  /** Simulation parameters */
  params: {
    densityLowColour: t.Color
    densityHighColour: t.Color
    renderHeightMap: boolean
    isCameraControlMode: boolean
  }
  /** Array of output subscribers */
  outputSubs: Array<(density: Float32Array[]) => void>
  /** Web Worker for model computation */
  worker: Worker
  /** Whether interaction is disabled */
  disableInteraction: boolean
}

/**
 * DiffusionPlane component with TSL-based material
 *
 * Features:
 * - TSL material that works with both WebGL and WebGPU renderers
 * - Reusable texture object (no GC pressure)
 * - Height map rendering support
 * - Force interaction via mouse/touch
 *
 * @example
 * ```tsx
 * <DiffusionPlane
 *   params={simulationParams}
 *   worker={worker}
 *   outputSubs={outputSubs}
 *   disableInteraction={false}
 * />
 * ```
 */
export function DiffusionPlane(props: DiffusionPlaneProps): JSX.Element {
  const meshRef = useRef<t.Mesh>(null)
  const densityTexture = useMemo(() => createDensityTexture(), [])
  const { viewport } = useThree()
  const baseThickness = 0.12
  const planeScale = useMemo(() => {
    const planeAspect = 5 / 4
    const maxWidth = viewport.width * 0.92
    const maxHeight = viewport.height * 0.92
    let width = maxWidth
    let height = width / planeAspect
    if (height > maxHeight) {
      height = maxHeight
      width = height * planeAspect
    }
    return [width, height, 1] as const
  }, [viewport.height, viewport.width])
  const baseColor = useMemo(() => {
    return props.params.densityLowColour.clone().multiplyScalar(0.35)
  }, [props.params.densityLowColour])

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      densityTexture.dispose()
    }
  }, [densityTexture])

  // Create color node from texture with low/high color interpolation
  const densityColorNode = useMemo(() => {
    // Create texture sampling node directly from texture
    // texture() from 'three/tsl' accepts a Texture and returns a TextureNode
    const densityTextureNode = textureNode(densityTexture)
    const densityValue = densityTextureNode.r

    // Create color uniforms for low and high density colors
    const lowColorUniform = uniform(
      vec3(
        props.params.densityLowColour.r,
        props.params.densityLowColour.g,
        props.params.densityLowColour.b,
      ),
    )
    const highColorUniform = uniform(
      vec3(
        props.params.densityHighColour.r,
        props.params.densityHighColour.g,
        props.params.densityHighColour.b,
      ),
    )

    // Normalize density to 0-1 range and interpolate between low and high colors
    const normalizedDensity = clamp(densityValue, 0.0, 1.0)
    return mix(lowColorUniform, highColorUniform, normalizedDensity)
  }, [
    densityTexture,
    props.params.densityLowColour,
    props.params.densityHighColour,
  ])

  const colorNode = useMemo(() => {
    if (!props.params.renderHeightMap) {
      return densityColorNode
    }

    // Blend top surface with density colors and keep sides a solid base color.
    const topThreshold = uniform(baseThickness / 2 - 0.002)
    const topScale = uniform(1 / 0.002)
    const topMask = clamp(positionLocal.z.sub(topThreshold).mul(topScale), 0, 1)
    const baseColorUniform = uniform(
      vec3(baseColor.r, baseColor.g, baseColor.b),
    )

    return mix(baseColorUniform, densityColorNode, topMask)
  }, [baseColor, baseThickness, densityColorNode, props.params.renderHeightMap])

  // Create conditional position node for height map displacement
  const positionNode = useMemo(() => {
    // When flat mode: no position node (undefined)
    if (!props.params.renderHeightMap) {
      return undefined
    }

    // When height map mode: displace vertices based on density
    const densityTextureNode = textureNode(densityTexture)
    const densityValue = densityTextureNode.r
    const heightScaleUniform = uniform(20.0)
    const topThreshold = uniform(baseThickness / 2 - 0.002)
    const topScale = uniform(1 / 0.002)
    const topMask = clamp(positionLocal.z.sub(topThreshold).mul(topScale), 0, 1)

    // Displace along local Z (becomes world Y due to mesh rotation)
    // positionNode expects the full position, so add to positionLocal.
    return positionLocal.add(
      vec3(0, 0, densityValue.mul(heightScaleUniform).mul(topMask)),
    )
  }, [baseThickness, densityTexture, props.params.renderHeightMap])

  // Subscribe to density updates from worker
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = []

    const outputSub = (data: Float32Array[]) => {
      // Copy data to prevent modification
      data = data.slice(0)

      // Calculate fps
      const fps = data.length

      // Create update function for a single frame
      const updateFrame = (frame: Float32Array) => {
        // Log a sample of the density data
        const sample = Array.from(frame.slice(0, 5)).map(v => v.toFixed(2))
        console.log(
          '[DiffusionPlane] Updating texture with density sample:',
          sample,
          '...',
        )

        updateDensityTexture(densityTexture, frame)
      }

      // Handle low fps with interpolation
      if (fps < 30) {
        // Calculate interpolation multiplier
        const interpMul = Math.ceil((30 - 1) / fps - 1)

        // Create interpolated data
        const interpData: Float32Array[] = []
        for (let i = 0; i < data.length; i++) {
          interpData.push(data[i])
          if (i + 1 < data.length) {
            const start = data[i]
            const end = data[i + 1]
            for (let j = 0; j < interpMul; j++) {
              const interp = new Float32Array(start.length)
              for (let k = 0; k < start.length; k++) {
                interp[k] =
                  start[k] + ((end[k] - start[k]) * (j + 1)) / (interpMul + 1)
              }
              interpData.push(interp)
            }
          }
        }

        // Render interpolated frames
        let i = 0
        const intervalId = setInterval(
          () => {
            if (i >= interpData.length) return
            updateFrame(interpData[i])
            i++
          },
          1000 / (data.length * interpMul),
        )
        intervals.push(intervalId)
      } else {
        // Render at original fps
        let i = 0
        const intervalId = setInterval(() => {
          if (i >= data.length) return
          updateFrame(data[i])
          i++
        }, 1000 / data.length)
        intervals.push(intervalId)
      }
    }

    // Subscribe to worker output
    props.outputSubs.push(outputSub)

    // Cleanup function: clear intervals and unsubscribe
    return () => {
      intervals.forEach(clearInterval)
      const idx = props.outputSubs.indexOf(outputSub)
      if (idx > -1) {
        props.outputSubs.splice(idx, 1)
      }
    }
  }, [densityTexture, props.outputSubs])

  // Camera control (fixed top-down view)
  // Fixed camera for flat mode or force application mode
  // Free camera for 3D orbit mode
  useFrame(state => {
    if (props.disableInteraction) return
    // Only force camera position when NOT in camera control mode
    if (!props.params.isCameraControlMode) {
      state.camera.position.set(0, 10, 0)
      state.camera.lookAt(0, 0, 0)
    }
  })

  // Interaction state (stored outside React state for performance)
  const pointMoved = useRef(false)
  const trackMove = useRef(false)
  const prevPointPos = useRef(new t.Vector2(0, 0))
  const pointPos = useRef(new t.Vector2(0, 0))

  const handlePointerDown = (e: ThreeEvent<PointerEvent>): void => {
    if (e.uv == null) return
    pointMoved.current = false
    trackMove.current = true
    // Make top left corner (0,0)
    prevPointPos.current.set(e.uv.x, 1 - e.uv.y)
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>): void => {
    if (!trackMove.current) return
    if (e.uv == null) return
    pointMoved.current = true
    pointPos.current.set(e.uv.x, 1 - e.uv.y)
  }

  const handlePointerUp = (): void => {
    pointMoved.current = false
    trackMove.current = false
  }

  // Force update interval (30 fps)
  useEffect(() => {
    const forceInterval = 1000 / 30
    const forceMul = 100
    const gridSize = new t.Vector2(32, 32)

    const interval = setInterval(() => {
      if (props.disableInteraction) return
      if (!pointMoved.current) return

      const forceDelta = new t.Vector2()
        .subVectors(pointPos.current, prevPointPos.current)
        .multiplyScalar(forceMul)
      const loc = new t.Vector2()
        .add(pointPos.current)
        .multiply(gridSize)
        .round()

      prevPointPos.current.set(pointPos.current.x, pointPos.current.y)
      pointMoved.current = false

      // Send force update to worker
      props.worker.postMessage({
        func: RunnerFunc.UPDATE_FORCE,
        args: {
          forceDelta,
          loc,
        } satisfies UpdateForceArgs,
      })
    }, forceInterval)

    return () => clearInterval(interval)
  }, [props.disableInteraction, props.worker])

  // Geometry based on render mode
  const segments = props.params.renderHeightMap ? 31 : 1

  return (
    <group rotation-x={-Math.PI / 2} scale={planeScale}>
      <mesh
        ref={meshRef}
        position={
          props.params.renderHeightMap ? [0, 0, -baseThickness / 2] : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {props.params.renderHeightMap ? (
          <boxGeometry args={[1, 1, baseThickness, segments, segments, 1]} />
        ) : (
          <planeGeometry args={[1, 1, segments, segments]} />
        )}
        <meshBasicNodeMaterial
          colorNode={colorNode}
          positionNode={positionNode}
        />
      </mesh>
      {/* OrbitControls for 3D camera control */}
      {props.params.isCameraControlMode && props.params.renderHeightMap && (
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={5}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2} // Don't go below the plane
        />
      )}
    </group>
  )
}
