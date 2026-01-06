import { type JSX, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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

  // take the json and have the user download it
  const save = useCallback((sav: ModelSave): void => {
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

    document.body.removeChild(link)
  }, [])

  useEffect(() => {
    if (!modelSaveSubs.includes(save)) {
      modelSaveSubs.push(save)
    }
    return () => {
      const index = modelSaveSubs.indexOf(save)
      if (index !== -1) {
        modelSaveSubs.splice(index, 1)
      }
    }
  }, [modelSaveSubs, save])

  return (
    <Card
      size="sm"
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex-row items-center gap-3 px-3 py-2 bg-[#142c3f]/85 text-white border border-white/10 shadow-[var(--shadow-lg)] backdrop-blur-xl z-40"
    >
      {/* Playback Controls */}
      <div className="flex items-center gap-1">
        <Button
          onClick={() => {
            worker.postMessage({
              func: RunnerFunc.START,
            } satisfies IncomingMessage)
          }}
          size="sm"
          className="bg-[#00a9ce] hover:bg-[#0097b8] text-white shadow-lg shadow-cyan-900/20 px-5 rounded-xl font-medium tracking-wide transition-all hover:scale-105 active:scale-95"
        >
          Play
        </Button>
        <Button
          onClick={() => {
            worker.postMessage({
              func: RunnerFunc.PAUSE,
            } satisfies IncomingMessage)
          }}
          size="sm"
          variant="ghost"
          className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
        >
          Pause
        </Button>
        <Button
          onClick={() => {
            // TODO: Implement stop functionality
            console.log('Stop clicked')
          }}
          size="sm"
          variant="ghost"
          className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
        >
          Stop
        </Button>
        <Button
          onClick={() => {
            worker.terminate()
          }}
          size="sm"
          variant="ghost"
          className="text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
        >
          Reset
        </Button>
      </div>

      <Separator orientation="vertical" className="bg-white/10 mx-1" />

      {/* Save/Restore Controls */}
      <div className="flex items-center gap-1">
        <Button
          onClick={() => {
            worker.postMessage({
              func: RunnerFunc.SERIALIZE,
            } satisfies IncomingMessage)
          }}
          size="sm"
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl text-xs font-normal"
        >
          Save
        </Button>
        <Button
          onClick={() => {
            setRestorePopupVisible(true)
          }}
          size="sm"
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl text-xs font-normal"
        >
          Restore
        </Button>
      </div>
    </Card>
  )
}
