import {
  type ThreeElements,
  type ThreeEvent,
  useFrame,
} from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as t from 'three'
import vertexShader from '../shaders/glsl/vertex.glsl'
import fragmentShader from '../shaders/glsl/fragment.glsl'
import {
  RunnerFunc,
  type UpdateForceArgs,
} from '../workers/modelWorkerMessage.ts'

class SimulationParams {
  // render options
  densityLowColour: t.Color = new t.Color('blue')
  densityHighColour: t.Color = new t.Color('red')

  renderHeightMap: boolean = false
  isCameraControlMode: boolean = false

  // renderer backend: 'webgl' | 'webgpu'
  rendererBackend: 'webgl' | 'webgpu' = 'webgl'
}

// we will store the parameters in an interface explicitly so
// we can pass the parameter object directly
interface Renderable {
  params: SimulationParams
  outputSubs: Array<(density: Float32Array[]) => void>
  worker: Worker
  disableInteraction: boolean
}

// converts a colour to vector3, does not preserve alpha
function colToVec3(col: t.Color): t.Vector3 {
  return new t.Vector3(col.r, col.g, col.b)
}

function DiffusionPlane(
  props: ThreeElements['mesh'] & Renderable,
): JSX.Element {
  // reference to the parent mesh
  const ref = useRef<t.Mesh>(null!)

  // create geometry based on render mode
  const geometry = useMemo(() => {
    if (props.params.renderHeightMap) {
      return new t.PlaneGeometry(10, 8, 31, 31)  // height map: 1024 vertices
    } else {
      return new t.PlaneGeometry(10, 8, 1, 1)    // flat: 4 vertices
    }
  }, [props.params.renderHeightMap])

  // create the shader
  const shaderMat = useMemo(() => {
    const shaderMat = new t.ShaderMaterial()

    // Use the new refactored shaders
    shaderMat.vertexShader = vertexShader as string
    shaderMat.fragmentShader = fragmentShader as string
    shaderMat.side = t.DoubleSide

    // Initial density texture (will be updated with real data)
    const initDensity = new Float32Array(new Array(64 * 64).fill(0))
    const tex = new t.DataTexture(initDensity, 64, 64, t.RedFormat, t.FloatType)
    tex.minFilter = t.LinearFilter
    tex.magFilter = t.LinearFilter
    tex.wrapS = t.ClampToEdgeWrapping
    tex.wrapT = t.ClampToEdgeWrapping
    tex.needsUpdate = true

    // Standard uniforms
    shaderMat.uniforms = {
      density: { value: tex },
      uHeightScale: { value: props.params.renderHeightMap ? 1.0 : 0.0 },
      uLowColor: { value: colToVec3(props.params.densityLowColour) },
      uHighColor: { value: colToVec3(props.params.densityHighColour) },
    }

    return shaderMat
  }, [
    props.params.densityHighColour,
    props.params.densityLowColour,
    props.params.renderHeightMap,
  ])

  // HOOKS

  useFrame(state => {
    if (disableInteraction) return
    // potential performance issue?
    state.camera.setRotationFromAxisAngle(new t.Vector3(1, 0, 0), -Math.PI / 2)
    state.camera.position.set(0, 10, 0)
    ref.current.lookAt(0, 99, 0)
  })

  // create a worker and assign it the model computations
  const { outputSubs, worker } = props

  // Use a ref to track current material, avoiding stale closure issues
  const materialRef = useRef<t.ShaderMaterial>(shaderMat)

  // Update ref when shaderMat changes
  useEffect(() => {
    materialRef.current = shaderMat
  }, [shaderMat])

  useEffect(() => {
    console.log('[renderer] [event] Creating worker')
    outputSubs.push((density: Float32Array[]) => {
      output(density)
    })

    // Store all interval IDs for cleanup
    const intervals: NodeJS.Timeout[] = []

    // SUBSCRIPTIONS
    // update the density uniforms every time
    // output is received
    function output(data: Float32Array[]): void {
      // create a copy to prevent modifying original data
      data = data.slice(0)

      // Normalization parameters
      const densityRangeHigh = 10.0
      const densityRangeLow = 0.0
      const densityRangeSize = 10.0

      function updateTexture(data: Float32Array): void {
        // texture float value is required to be in range [0.0, 1.0],
        // so we have to convert this in js
        for (let i = 0; i < data.length; i++) {
          let density = Math.min(data[i], densityRangeHigh)
          density = Math.max(density, densityRangeLow)
          density = density / densityRangeSize
          data[i] = density
        }
        const tex = new t.DataTexture(data, 64, 64, t.RedFormat, t.FloatType)
        tex.minFilter = t.LinearFilter
        tex.magFilter = t.LinearFilter
        tex.wrapS = t.ClampToEdgeWrapping
        tex.wrapT = t.ClampToEdgeWrapping
        tex.needsUpdate = true
        // Use ref to always get the current material
        materialRef.current.uniforms.density.value = tex
      }
      // calculate the fps
      console.log(`[renderer] [event] Received output, fps: ${data.length}`)
      if (data.length < 30) {
        console.log(
          `[renderer] [event] FPS is low: ${data.length}, interpolation in progress`,
        )
        // interpolate based on current frame rate
        // calc the interplot multiplier
        const interpMul = Math.ceil((30 - 1) / data.length - 1)
        console.log(`[renderer] [event] Interpolation multiplier: ${interpMul}`)
        // create the interpolated data
        const interpData: Float32Array[] = []
        // interpolate
        for (let i = 0; i < data.length; i++) {
          // start with the first original frame, then interpolate interpMul times with linear interpolation,
          // then add the next original frame
          console.log(
            `[renderer] [event] Interpolating frame ${i + 1}/${data.length}`,
          )
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

        console.log(
          `[renderer] [event] Interpolation complete, fps: ${interpData.length}`,
        )
        let i = 0
        // start the interpolation
        const intervalId = setInterval(
          () => {
            if (i >= interpData.length) return
            updateTexture(interpData[i])
            i++
          },
          1000 / (data.length * interpMul),
        )
        intervals.push(intervalId)
      } else {
        let i = 0
        const intervalId = setInterval(() => {
          if (i >= data.length) return
          updateTexture(data[i])
          i++
        }, 1000 / data.length)
        intervals.push(intervalId)
      }
    }

    // Cleanup function: clear all intervals when effect reruns or unmounts
    return () => {
      intervals.forEach(clearInterval)
    }
  }, [outputSubs])

  const { disableInteraction } = props
  let pointMoved = false
  let trackMove = false
  const prevPointPos = new t.Vector2(0, 0)
  const pointPos = new t.Vector2(0, 0)
  const pointDown = (e: ThreeEvent<PointerEvent>): void => {
    if (e.uv == null) return
    pointMoved = false
    trackMove = true
    // make top left corner (0,0)
    prevPointPos.set(e.uv.x, 1 - e.uv.y)
  }
  const pointMove = (e: ThreeEvent<PointerEvent>): void => {
    if (!trackMove) return
    if (e.uv == null) return
    pointMoved = true
    pointPos.set(e.uv.x, 1 - e.uv.y)
  }
  const pointUp = (_e: ThreeEvent<PointerEvent>): void => {
    pointMoved = false
    trackMove = false
  }
  // 30 fps force update for now
  const forceInterval = 1000 / 30
  // should be in config
  const forceMul = 100
  // grid size of model, should be changed with config
  const gridSize = new t.Vector2(32, 32)
  setInterval(() => {
    if (disableInteraction) return
    if (!pointMoved) return
    const forceDelta = new t.Vector2()
      .subVectors(pointPos, prevPointPos)
      .multiplyScalar(forceMul)
    const loc = new t.Vector2().add(pointPos).multiply(gridSize).round()
    prevPointPos.set(pointPos.x, pointPos.y)
    pointMoved = false
    console.log('[event] Applying force', forceDelta, 'at', loc)
    // call model with param
    worker.postMessage({
      func: RunnerFunc.UPDATE_FORCE,
      args: {
        forceDelta,
        loc,
      } satisfies UpdateForceArgs,
    })
  }, forceInterval)

  return (
    <mesh
      {...props}
      ref={ref}
      material={shaderMat}
      onPointerUp={pointUp}
      onPointerDown={pointDown}
      onPointerMove={pointMove}
    >
      <primitive object={geometry} attach="geometry" />
    </mesh>
  )
}

export { DiffusionPlane, SimulationParams }
