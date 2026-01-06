import type { ThreeEvent } from '@react-three/fiber'
import { useFrame, useThree } from '@react-three/fiber'
import { type JSX, useEffect, useMemo, useRef } from 'react'
import * as t from 'three'
import { clamp, mix, texture as textureNode, uniform, vec3 } from 'three/tsl'
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

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      densityTexture.dispose()
    }
  }, [densityTexture])

  // Create color node from texture with low/high color interpolation
  const colorNode = useMemo(() => {
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
  useFrame(state => {
    if (props.disableInteraction) return
    state.camera.position.set(0, 10, 0)
    state.camera.lookAt(0, 0, 0)
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
    <mesh
      ref={meshRef}
      rotation-x={-Math.PI / 2}
      scale={planeScale}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <planeGeometry args={[1, 1, segments, segments]} />
      <meshBasicNodeMaterial colorNode={colorNode} />
    </mesh>
  )
}
