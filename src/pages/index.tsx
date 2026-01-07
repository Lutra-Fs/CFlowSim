import { Canvas, extend, type ThreeToJSXElements } from '@react-three/fiber'
import {
  type JSX,
  Suspense,
  useCallback,
  useEffect,
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
import type { ModelWorkerClient } from '../workers/workerClient'

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
  workerClient: ModelWorkerClient | null
  isActive: boolean
}

export default function Home(props: IndexProp): JSX.Element {
  const { workerClient, isActive } = props
  const [simulationParams, setSimulationParams] = useState(
    () => new SimulationParams(),
  )
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [showPerfOverlay, setShowPerfOverlay] = useState(false)
  const rendererBackend = simulationParams.rendererBackend
  const perfStatsRef = useRef<PerfStats | null>(null)
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

  const [restorePopupVisible, setRestorePopupVisible] = useState(false)

  useEffect(() => {
    if (!workerClient) return
    workerClient.setActive(isActive).catch(error => {
      console.error('Worker setActive failed', error)
    })
  }, [isActive, workerClient])

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
              workerClient={workerClient}
            />
          </Suspense>
        </Canvas>
      </div>
      {restorePopupVisible && workerClient ? (
        <RestorePopup
          workerClient={workerClient}
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
        workerClient={workerClient}
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
