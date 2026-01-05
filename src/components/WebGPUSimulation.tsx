import { useEffect, useRef } from 'react'
import * as t from 'three'
import { initWebGPU } from '../lib/webgpu/device.js'
import { WebGPURenderPipeline, type RenderUniforms } from '../lib/webgpu/renderPipeline.js'

interface Renderable {
  params: {
    densityLowColour: t.Color
    densityHighColour: t.Color
    renderHeightMap: boolean
    isCameraControlMode: boolean
  }
  outputSubs: Array<(density: Float32Array[]) => void>
  worker: Worker
  disableInteraction: boolean
}

interface WebGPUSimulationProps extends Renderable {
  width?: number
  height?: number
}

export function WebGPUSimulation(props: WebGPUSimulationProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pipelineRef = useRef<WebGPURenderPipeline | null>(null)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Initialize WebGPU
    let device: GPUDevice | null = null
    let pipeline: WebGPURenderPipeline | null = null

    const init = async () => {
      try {
        device = await initWebGPU()
        pipeline = new WebGPURenderPipeline(
          device,
          canvas,
          navigator.gpu.getPreferredCanvasFormat(),
          props.params.renderHeightMap,
        )
        pipelineRef.current = pipeline

        // Subscribe to density updates
        props.outputSubs.push((density: Float32Array[]) => {
          // Use the first frame for now
          if (density[0]) {
            pipeline?.updateDensity(density[0])
          }
        })

        // Start render loop
        const renderLoop = () => {
          // Update uniforms
          const width = 10.0
          const height = 8.0
          const aspect = canvas.width / canvas.height

          // Camera setup (top-down view)
          const camera = new t.PerspectiveCamera(75, aspect, 0.1, 1000)
          camera.position.set(0, 10, 0)
          camera.lookAt(0, 0, 0)

          // Projection matrix (using manual construction for correct parameters)
          const fov = 75 * (Math.PI / 180)
          const near = 0.1
          const far = 1000
          const top = near * Math.tan(fov / 2)
          const bottom = -top
          const right = top * aspect
          const left = -right

          const projectionMatrix = new t.Matrix4()
          projectionMatrix.makePerspective(left, right, top, bottom, near, far)

          // Model-view matrix
          const modelViewMatrix = new t.Matrix4()
          modelViewMatrix.lookAt(new t.Vector3(0, 10, 0), new t.Vector3(0, 0, 0), new t.Vector3(0, 0, -1))

          const uniforms: RenderUniforms = {
            uWidth: width,
            uHeight: height,
            uHeightScale: props.params.renderHeightMap ? 1.0 : 0.0,
            uLowColor: new t.Vector3(
              props.params.densityLowColour.r,
              props.params.densityLowColour.g,
              props.params.densityLowColour.b,
            ),
            uHighColor: new t.Vector3(
              props.params.densityHighColour.r,
              props.params.densityHighColour.g,
              props.params.densityHighColour.b,
            ),
            projectionMatrix,
            modelViewMatrix,
          }

          pipeline?.updateUniforms(uniforms)
          pipeline?.render()
          animationFrameRef.current = requestAnimationFrame(renderLoop)
        }

        renderLoop()
      } catch (error) {
        console.error('Failed to initialize WebGPU:', error)
      }
    }

    init()

    // Handle resize
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    // Interaction handling (TODO: implement)
    const handlePointerDown = (_e: PointerEvent) => {
      if (props.disableInteraction) return
      // Calculate UV from pointer position and send to worker
    }

    const handlePointerMove = (_e: PointerEvent) => {
      if (props.disableInteraction) return
      // Similar to pointerDown
    }

    const handlePointerUp = () => {
      // End interaction
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('resize', handleResize)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      pipeline?.cleanup()
    }
  }, [props.params, props.disableInteraction, props.outputSubs])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  )
}
