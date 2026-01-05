import { Button, Space } from 'antd'
import { useEffect } from 'react'
import type { ModelSave } from '../services/model/modelService'
import {
  type IncomingMessage,
  RunnerFunc,
} from '../workers/modelWorkerMessage.ts'

interface ControlBarProps {
  modelSaveSubs: Array<(save: ModelSave) => void>
  worker: Worker
  setRestorePopupVisible: React.Dispatch<React.SetStateAction<boolean>>
}

export default function ControlBar(props: ControlBarProps): JSX.Element {
  const { modelSaveSubs, worker, setRestorePopupVisible } = props

  useEffect(() => {
    if (!modelSaveSubs.includes(save)) {
      modelSaveSubs.push(save)
    }
    return () => {
      const index = modelSaveSubs.findIndex(value => value === save)
      if (index !== -1) {
        modelSaveSubs.splice(index, 1)
      }
    }
  }, [modelSaveSubs])

  // take the json and have the user download it
  function save(sav: ModelSave): void {
    const filename = `${sav.modelType}@${sav.time}.json`
    const dat = JSON.stringify(sav)
    const blob = new Blob([dat], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)

    link.click()

    URL.revokeObjectURL(url)
    document.body.removeChild(link)

    console.log('wrote a save to ' + filename, sav)
  }

  // take a file and send its contents to the worker

  return (
    <>
      <Button
        onClick={() => {
          worker.postMessage({
            func: RunnerFunc.SERIALIZE,
          } satisfies IncomingMessage)
        }}
        className="absolute bottom-16 right-[11rem] text-[#eeeeee] bg-[#555555] h-[3.2rem] w-[8rem] m-0 mx-1 cursor-pointer max-[760px]:mb-1"
      >
        Save Model
      </Button>
      <Button
        onClick={() => {
          // create a RestorePopup component to handle input
          setRestorePopupVisible(true)
        }}
        className="absolute bottom-16 right-2 text-[#eeeeee] bg-[#555555] h-[3.2rem] w-[8rem] m-0 mx-1 cursor-pointer max-[760px]:mb-1"
      >
        Restore Model
      </Button>
      <Space
        size="small"
        direction="horizontal"
        className="absolute bottom-4 right-4 z-[100] flex"
      >
        <Button
          onClick={() => {
            worker.postMessage({
              func: RunnerFunc.START,
            } satisfies IncomingMessage)
          }}
        >
          Play
        </Button>
        <Button
          onClick={() => {
            worker.postMessage({
              func: RunnerFunc.PAUSE,
            } satisfies IncomingMessage)
          }}
        >
          Pause
        </Button>
        <Button onClick={() => {}}>Stop</Button>
        <Button
          onClick={() => {
            worker.terminate()
          }}
        >
          TERMINATE
        </Button>
      </Space>
    </>
  )
}
