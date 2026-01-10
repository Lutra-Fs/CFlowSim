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
import type { InitDataItem } from '@/services/initData/initDataService'
import ControlBar from '../components/ControlBar'
import ControlBarNew from '../components/ControlBarNew'
import { DiffusionPlane } from '../components/DiffusionPlane'
import ParBar from '../components/ParametersBar'
import ParametersBarNew from '../components/ParametersBarNew'
import {
  DebugModeIndicator,
  PerfOverlay,
  PerfProbe,
  type PerfStats,
} from '../components/PerfOverlay'
import RestorePopup from '../components/RestoreComponents/RestorePopUp'
import { SimulationParams } from '../components/SimulationParams'
import { resolveAssetPath } from '../utils/assetUrl'
import { createLogger } from '../utils/logger'
import type { ModelWorkerClient } from '../workers/workerClient'

const logger = createLogger('HomePage')

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
  const [currentInitStateId, setCurrentInitStateId] = useState<string>(
    'pvf_incomp_44_nonneg:0',
  )
  const rendererBackend = simulationParams.rendererBackend
  const perfStatsRef = useRef<PerfStats | null>(null)
  useEffect(() => {
    const confirmExit = (e: BeforeUnloadEvent): void => {
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
      logger.debug('Initializing WebGPURenderer')
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
      logger.debug('WebGPURenderer initialized', {
        backend: renderer.backend?.constructor?.name,
        forceWebGL,
      })
      return renderer
    },
    [rendererBackend],
  )

  const handleInitStateChange = useCallback(
    async (item: InitDataItem): Promise<void> => {
      if (!workerClient) return

      try {
        const resolvedPath = resolveAssetPath(item.path)
        await workerClient.reinit({ initConditionPath: resolvedPath })

        const categoryId = item.path.split('/')[2]
        setCurrentInitStateId(`${categoryId}:${item.id}`)
      } catch (error) {
        console.error('Failed to reinitialize with new init state', error)
      }
    },
    [workerClient],
  )

  const useNewUX = import.meta.env.VITE_NEW_UX === 'true'

  return (
    <>
      {/* Debug mode indicator - only shows in development */}
      {import.meta.env.DEV && <DebugModeIndicator />}

      {useNewUX ? (
        <ParametersBarNew
          params={simulationParams}
          setParams={setSimulationParams}
          onOpenChange={setIsPanelOpen}
          currentInitStateId={currentInitStateId}
          onInitStateChange={handleInitStateChange}
        />
      ) : (
        <ParBar
          params={simulationParams}
          setParams={setSimulationParams}
          onOpenChange={setIsPanelOpen}
          currentInitStateId={currentInitStateId}
          onInitStateChange={handleInitStateChange}
        />
      )}

      <div
        className={`absolute inset-0 z-0 px-6 pt-[calc(var(--header-height)+var(--spacing-4))] pb-24 ${
          isPanelOpen && !useNewUX
            ? 'pl-[calc(var(--sidebar-width)+var(--spacing-6))]'
            : ''
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
      {useNewUX ? (
        <ControlBarNew
          workerClient={workerClient}
          setRestorePopupVisible={setRestorePopupVisible}
          showPerfOverlay={showPerfOverlay}
          setShowPerfOverlay={setShowPerfOverlay}
        />
      ) : (
        <ControlBar
          workerClient={workerClient}
          setRestorePopupVisible={setRestorePopupVisible}
          showPerfOverlay={showPerfOverlay}
          setShowPerfOverlay={setShowPerfOverlay}
        />
      )}
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
