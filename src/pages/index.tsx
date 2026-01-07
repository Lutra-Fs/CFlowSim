import { Canvas, extend, type ThreeToJSXElements } from '@react-three/fiber'
import {
  type JSX,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three/webgpu'
import ControlBar from '../components/ControlBar'
import { DiffusionPlane } from '../components/DiffusionPlane'
import ParBar from '../components/ParametersBar'
import {
  DebugModeIndicator,
  type PerfStats,
  PerfOverlay,
  PerfProbe,
} from '../components/PerfOverlay'
import RestorePopup from '../components/RestoreComponents/RestorePopUp'
import { SimulationParams } from '../components/SimulationParams'
import type { ModelSave } from '../services/model/modelService'
import {
  type IncomingMessage,
  type OutgoingMessage,
  RunnerFunc,
} from '../workers/modelWorkerMessage'

// Debug logging for environment detection (can be removed after verification)
console.log('[ENV] DEV:', import.meta.env.DEV, 'MODE:', import.meta.env.MODE)

// Extend React Three Fiber to support WebGPU materials (v9 syntax)
// NOTE: Must extend(THREE) not extend({ MeshBasicNodeMaterial: ... }) to avoid TSL compilation errors
// See: https://discourse.threejs.org/t/tsl-in-react-three-fiber/83862
// biome-ignore lint/suspicious/noExplicitAny: Required for R3F WebGPU support - THREE types incompatible with extend()
extend(THREE as any)

// Type declaration for WebGPU types that aren't in ThreeElements
declare module '@react-three/fiber' {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

interface IndexProp {
  worker: Worker | null
  isActive: boolean
}

export default function Home(props: IndexProp): JSX.Element {
  const { worker, isActive } = props
  const [simulationParams, setSimulationParams] = useState(
    () => new SimulationParams(),
  )
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [showPerfOverlay, setShowPerfOverlay] = useState(false)
  const rendererBackend = simulationParams.rendererBackend
  const perfStatsRef = useRef<PerfStats | null>(null)
  const workerReadyRef = useRef(false)
  const isActiveRef = useRef(isActive)
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
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    if (!worker) return
    workerReadyRef.current = false
    worker.onmessage = e => {
      const data = e.data as OutgoingMessage

      switch (data.type) {
        case 'init':
          console.log('worker initialised')
          workerReadyRef.current = true
          if (isActiveRef.current) {
            worker.postMessage({
              func: RunnerFunc.START,
            } satisfies IncomingMessage)
          }
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
            if (!data.save) {
              throw new Error('data.save is undefined')
            }
            x(data.save)
          }
          break
      }
    }
    worker.onerror = e => {
      console.log(e)
    }
  }, [worker, outputSubs, modelSaveSubs])

  useEffect(() => {
    if (!worker || !workerReadyRef.current) return
    worker.postMessage({
      func: isActive ? RunnerFunc.START : RunnerFunc.PAUSE,
    } satisfies IncomingMessage)
  }, [isActive, worker])

  const createRenderer = useCallback(
    async (
      // biome-ignore lint/suspicious/noExplicitAny: WebGPURenderer expects different props than WebGL renderer
      props: any,
    ) => {
      console.log('[DEBUG] Initializing WebGPURenderer...')
      // R3F passes WebGL types, but WebGPURenderer expects WebGPU types
      // Filter out incompatible properties like powerPreference
      const { powerPreference: _powerPreference, ...webgpuProps } = props
      const forceWebGL = rendererBackend === 'webgl'
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
    },
    [rendererBackend],
  )

  return (
    <>
      {/* Debug mode indicator - only shows in development */}
      {import.meta.env.DEV && <DebugModeIndicator />}

      <ParBar
        params={simulationParams}
        setParams={setSimulationParams}
        onOpenChange={setIsPanelOpen}
      />
      <div
        className={`absolute inset-0 z-0 px-6 pt-[calc(var(--header-height)+var(--spacing-4))] pb-24 ${
          isPanelOpen ? 'pl-[calc(var(--sidebar-width)+var(--spacing-6))]' : ''
        }`}
      >
        <Canvas
          key={rendererBackend}
          frameloop={isActive ? 'always' : 'demand'}
          shadows
          camera={{
            position: [0, 10, 0],
            fov: 75,
          }}
          className="h-full w-full bg-transparent"
          gl={createRenderer}
        >
          {import.meta.env.DEV && showPerfOverlay && isActive ? (
            <PerfProbe statsRef={perfStatsRef} />
          ) : null}
          <Suspense fallback={<LoadingSpinner />}>
            <DiffusionPlane
              isActive={isActive}
              disableInteraction={simulationParams.isCameraControlMode}
              params={simulationParams}
              worker={worker}
              outputSubs={outputSubs}
            />
          </Suspense>
        </Canvas>
      </div>
      {restorePopupVisible && worker ? (
        <RestorePopup
          worker={worker}
          setRestorePopupVisible={setRestorePopupVisible}
        />
      ) : null}
      {import.meta.env.DEV && showPerfOverlay && isActive ? (
        <PerfOverlay
          rendererBackend={rendererBackend}
          statsRef={perfStatsRef}
        />
      ) : null}
      <ControlBar
        modelSaveSubs={modelSaveSubs}
        worker={worker}
        setRestorePopupVisible={setRestorePopupVisible}
        showPerfOverlay={showPerfOverlay}
        setShowPerfOverlay={setShowPerfOverlay}
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
