import { Canvas, extend, type ThreeToJSXElements } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState, type JSX } from 'react'
import * as THREE from 'three/webgpu'
import ControlBar from '../components/ControlBar'
import { DiffusionPlane } from '../components/DiffusionPlane'
import { SimulationParams } from '../components/SimulationParams'
import ParBar from '../components/ParametersBar'
import RestorePopup from '../components/RestoreComponents/RestorePopUp'
import type { ModelSave } from '../services/model/modelService'
import {
  type IncomingMessage,
  type OutgoingMessage,
  RunnerFunc,
} from '../workers/modelWorkerMessage'

// Extend React Three Fiber to support WebGPU materials (v9 syntax)
// NOTE: Must extend(THREE) not extend({ MeshBasicNodeMaterial: ... }) to avoid TSL compilation errors
// See: https://discourse.threejs.org/t/tsl-in-react-three-fiber/83862
extend(THREE as any)

// Type declaration for WebGPU types that aren't in ThreeElements
declare module '@react-three/fiber' {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

interface IndexProp {
  simulationParams: SimulationParams
  setSimulationParams: React.Dispatch<React.SetStateAction<SimulationParams>>
  worker: Worker
}

export default function Home(props: IndexProp): JSX.Element {
  const { simulationParams, setSimulationParams, worker } = props
  useEffect(() => {
    const confirmExit = (e: BeforeUnloadEvent): void => {
      console.log('beforeunload event triggered')
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', confirmExit)
    return () => {
      window.removeEventListener('beforeunload', confirmExit)
    }
  }, [])

  // to distribute the worker messages across different components
  // we utilise an observer pattern where components can subscribe
  // their functions to different message types
  const outputSubs: Array<(density: Float32Array[]) => void> = useMemo(
    () => [],
    [],
  )

  const modelSaveSubs: Array<(save: ModelSave) => void> = useMemo(() => [], [])
  const [restorePopupVisible, setRestorePopupVisible] = useState(false)

  // distribute the worker callback
  useEffect(() => {
    if (worker !== null) {
      worker.onmessage = e => {
        const data = e.data as OutgoingMessage

        switch (data.type) {
          case 'init':
            console.log('worker initialised')
            worker.postMessage({
              func: RunnerFunc.START,
            } satisfies IncomingMessage)
            break
          case 'output':
            for (const x of outputSubs)
              if (data.density !== undefined) x(data.density)
            break

          case 'modelSave':
            for (const x of modelSaveSubs) {
              if (data === null)
                throw new Error(
                  'error in calling worker.modelSave, data was null',
                )
              x(data.save!)
            }
            break
        }
      }
      worker.onerror = e => {
        console.log(e)
      }
    }
  }, [worker, outputSubs, modelSaveSubs])

  return (
    <>
      <ParBar params={simulationParams} setParams={setSimulationParams} />
      <div className="relative left-[21rem] top-4 w-[calc(100%-22rem)] h-[calc(100%-7rem)] z-0 max-[760px]:left-[6rem] max-[760px]:top-[6rem] max-[760px]:w-[calc(100vw-12rem)] max-[760px]:h-[calc(100vh-6rem)]">
        <Canvas
          shadows
          camera={{
            position: [0, 10, 0],
            fov: 75,
          }}
          className="bg-transparent"
          gl={async (props) => {
            console.log('[DEBUG] Initializing WebGPURenderer...')
            // R3F passes WebGL types, but WebGPURenderer expects WebGPU types
            // Filter out incompatible properties like powerPreference
            const { powerPreference: _powerPreference, ...webgpuProps } =
              props as any
            const forceWebGL = simulationParams.rendererBackend === 'webgl'
            const renderer = new THREE.WebGPURenderer({
              ...webgpuProps,
              antialias: true,
              alpha: true,
              forceWebGL,
            })
            await renderer.init()
            renderer.setClearColor(0x000000, 0)
            console.log(
              '[DEBUG] WebGPURenderer backend:',
              renderer.backend?.constructor?.name,
              'forceWebGL:',
              forceWebGL,
            )
            return renderer
          }}
        >
          <Suspense fallback={<LoadingSpinner />}>
            <DiffusionPlane
              disableInteraction={simulationParams.isCameraControlMode}
              params={simulationParams}
              worker={worker}
              outputSubs={outputSubs}
            />
          </Suspense>
        </Canvas>
      </div>
      {restorePopupVisible && (
        <RestorePopup
          worker={worker}
          setRestorePopupVisible={setRestorePopupVisible}
        />
      )}
      <ControlBar
        modelSaveSubs={modelSaveSubs}
        worker={worker}
        setRestorePopupVisible={setRestorePopupVisible}
      />
    </>
  )
}

/**
 * Loading spinner component for Suspense fallback
 * Shows while WebGPU renderer is initializing
 */
function LoadingSpinner(): JSX.Element {
  return (
    <group position={[0, 0, 0]}>
      <mesh>
        <planeGeometry args={[10, 8]} />
        <meshBasicMaterial color="#333" />
      </mesh>
    </group>
  )
}
