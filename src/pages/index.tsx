import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import ControlBar from '../components/ControlBar'
import ParBar from '../components/ParametersBar'
import RestorePopup from '../components/RestoreComponents/RestorePopUp'
import { DiffusionPlane, type SimulationParams } from '../components/Simulation'
import WebGPUCanvas from '../components/WebGPUCanvas'
import type { ModelSave } from '../services/model/modelService'
import {
  type IncomingMessage,
  type OutgoingMessage,
  RunnerFunc,
} from '../workers/modelWorkerMessage'

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
        <WebGPUCanvas
          shadows
          camera={{
            position: [1, 10, 1],
          }}
        >
          <ambientLight />
          <OrbitControls
            target={[0, 0, 0]}
            enabled={simulationParams.isCameraControlMode}
          ></OrbitControls>
          <DiffusionPlane
            disableInteraction={simulationParams.isCameraControlMode}
            position={[0, 0, 0]}
            params={simulationParams}
            worker={worker}
            outputSubs={outputSubs}
          />
        </WebGPUCanvas>
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
