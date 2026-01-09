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
import type { ModelWorkerClient } from '../workers/workerClient'
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
  /** Worker client for model computation */
  workerClient: ModelWorkerClient | null
  /** Whether interaction is disabled */
  disableInteraction: boolean
  /** Whether rendering is active */
  isActive: boolean
}

type FramePacket = {
  frame: Float32Array
  delayMs: number
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
 *   workerClient={workerClient}
 *   disableInteraction={false}
 * />
 * ```
 */
export function DiffusionPlane(props: DiffusionPlaneProps): JSX.Element {
  const meshRef = useRef<t.Mesh>(null)
  const densityTexture = useMemo(() => createDensityTexture(), [])
  const frameQueueRef = useRef<FramePacket[]>([])
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const lowColorHex = props.params.densityLowColour.getHexString()
  const highColorHex = props.params.densityHighColour.getHexString()

  const baseColor = useMemo(() => {
    const color = new t.Color(`#${lowColorHex}`)
    return color.multiplyScalar(0.35)
  }, [lowColorHex])

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      densityTexture.dispose()
    }
  }, [densityTexture])

  // Create color node from texture with low/high color interpolation
  const densityColorNode = useMemo(() => {
    const densityTextureNode = textureNode(densityTexture)
    const densityValue = densityTextureNode.r

    const lowColor = new t.Color(`#${lowColorHex}`)
    const highColor = new t.Color(`#${highColorHex}`)
    const lowColorUniform = uniform(vec3(lowColor.r, lowColor.g, lowColor.b))
    const highColorUniform = uniform(vec3(highColor.r, highColor.g, highColor.b))

    const normalizedDensity = clamp(densityValue, 0.0, 1.0)
    return mix(lowColorUniform, highColorUniform, normalizedDensity)
  }, [densityTexture, lowColorHex, highColorHex])

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
    const heightScaleUniform = uniform(6.6666666667)
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
    if (!props.workerClient) return
    let isUnmounted = false

    const outputSub = (data: Float32Array[]) => {
      if (!props.isActive) return
      // Copy data to prevent modification
      const frames = data.slice(0)

      // Calculate fps
      const fps = frames.length
      if (fps === 0) return

      // Create update function for a single frame
      const updateFrame = (frame: Float32Array) => {
        updateDensityTexture(densityTexture, frame)
      }

      const scheduleNext = () => {
        if (isUnmounted) return
        if (!props.isActive) {
          playbackTimerRef.current = null
          return
        }
        const next = frameQueueRef.current.shift()
        if (!next) {
          playbackTimerRef.current = null
          return
        }
        updateFrame(next.frame)
        playbackTimerRef.current = setTimeout(scheduleNext, next.delayMs)
      }

      const enqueueFrames = (queuedFrames: Float32Array[], delayMs: number) => {
        for (const frame of queuedFrames) {
          frameQueueRef.current.push({ frame, delayMs })
        }
        if (playbackTimerRef.current === null) {
          scheduleNext()
        }
      }

      // Handle low fps with interpolation
      if (fps < 30) {
        // Calculate interpolation multiplier
        const interpMul = Math.ceil((30 - 1) / fps - 1)

        // Create interpolated data
        if (interpMul > 0) {
          const interpData: Float32Array[] = []
          for (let i = 0; i < frames.length; i++) {
            interpData.push(frames[i])
            if (i + 1 < frames.length) {
              const start = frames[i]
              const end = frames[i + 1]
              for (let j = 0; j < interpMul; j++) {
                const interp = new Float32Array(start.length)
                for (let k = 0; k < start.length; k++) {
                  interp[k] =
                    start[k] +
                    ((end[k] - start[k]) * (j + 1)) / (interpMul + 1)
                }
                interpData.push(interp)
              }
            }
          }
          const intervalMs = 1000 / (frames.length * interpMul)
          enqueueFrames(interpData, intervalMs)
          return
        }
      }

      // Render at original fps
      const intervalMs = 1000 / frames.length
      enqueueFrames(frames, intervalMs)
    }

    // Subscribe to worker output
    const unsubscribe = props.workerClient.onOutput(outputSub)

    // Cleanup function: clear intervals and unsubscribe
    return () => {
      isUnmounted = true
      if (playbackTimerRef.current !== null) {
        clearTimeout(playbackTimerRef.current)
      }
      playbackTimerRef.current = null
      frameQueueRef.current = []
      unsubscribe()
    }
  }, [densityTexture, props.isActive, props.workerClient])

  useEffect(() => {
    if (props.isActive) return
    if (playbackTimerRef.current !== null) {
      clearTimeout(playbackTimerRef.current)
    }
    playbackTimerRef.current = null
    frameQueueRef.current = []
  }, [props.isActive])

  // Camera control (fixed top-down view)
  // Fixed camera for flat mode or force application mode
  // Free camera for 3D orbit mode
  useFrame(state => {
    if (!props.isActive || props.disableInteraction) return
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
      if (!props.isActive || props.disableInteraction) return
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

      if (!props.workerClient) return
      props.workerClient.updateForce({
        forceDelta: { x: forceDelta.x, y: forceDelta.y },
        loc: { x: loc.x, y: loc.y },
      })
    }, forceInterval)

    return () => clearInterval(interval)
  }, [props.disableInteraction, props.isActive, props.workerClient])

  // Geometry based on render mode
  const segments = props.params.renderHeightMap ? 31 : 1

  if (props.params.renderHeightMap) {
    return (
      <group rotation-x={-Math.PI / 2} scale={planeScale}>
        <mesh
          ref={meshRef}
          position={[0, 0, -baseThickness / 2]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <boxGeometry args={[1, 1, baseThickness, segments, segments, 1]} />
          <meshBasicNodeMaterial
            key={`height-${lowColorHex}-${highColorHex}`}
            colorNode={colorNode}
            positionNode={positionNode}
          />
        </mesh>
        {/* OrbitControls for 3D camera control */}
        {props.params.isCameraControlMode && (
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

  return (
    <group rotation-x={-Math.PI / 2} scale={planeScale}>
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[1, 1, segments, segments]} />
      <meshBasicNodeMaterial
        key={`flat-${lowColorHex}-${highColorHex}`}
        colorNode={densityColorNode}
      />
      </mesh>
    </group>
  )
}
