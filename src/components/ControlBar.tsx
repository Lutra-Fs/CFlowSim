import { type JSX, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ModelSave } from '../services/model/modelService'
import type { ModelWorkerClient } from '../workers/workerClient'

interface ControlBarProps {
  workerClient: ModelWorkerClient | null
  setRestorePopupVisible: React.Dispatch<React.SetStateAction<boolean>>
  showPerfOverlay: boolean
  setShowPerfOverlay: React.Dispatch<React.SetStateAction<boolean>>
}

export default function ControlBar(props: ControlBarProps): JSX.Element {
  const {
    workerClient,
    setRestorePopupVisible,
    showPerfOverlay,
    setShowPerfOverlay,
  } = props
  const hasWorker = workerClient !== null

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

  const handleSave = useCallback((): void => {
    if (!workerClient) return
    workerClient
      .serialize()
      .then(save)
      .catch(error => {
        console.error('Worker serialize failed', error)
      })
  }, [save, workerClient])

  return (
    <Card
      size="sm"
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex-row items-center gap-3 px-3 py-2 bg-[#142c3f]/85 text-white border border-white/10 shadow-[var(--shadow-lg)] backdrop-blur-xl z-40"
    >
      {/* Playback Controls */}
      <div className="flex items-center gap-1">
        <Button
          onClick={() => {
            if (!workerClient) return
            workerClient.start().catch(error => {
              console.error('Worker start failed', error)
            })
          }}
          size="sm"
          className="bg-[#00a9ce] hover:bg-[#0097b8] text-white shadow-lg shadow-cyan-900/20 px-5 rounded-xl font-medium tracking-wide transition-all hover:scale-105 active:scale-95"
          disabled={!hasWorker}
        >
          Play
        </Button>
        <Button
          onClick={() => {
            if (!workerClient) return
            workerClient.pause()
          }}
          size="sm"
          variant="ghost"
          className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
          disabled={!hasWorker}
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
            if (!workerClient) return
            workerClient.terminate()
          }}
          size="sm"
          variant="ghost"
          className="text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
          disabled={!hasWorker}
        >
          Reset
        </Button>
      </div>

      <Separator orientation="vertical" className="bg-white/10 mx-1" />

      {/* Save/Restore Controls */}
      <div className="flex items-center gap-1">
        <Button
          onClick={() => {
            handleSave()
          }}
          size="sm"
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl text-xs font-normal"
          disabled={!hasWorker}
        >
          Save
        </Button>
        {import.meta.env.DEV ? (
          <Button
            onClick={() => {
              setShowPerfOverlay(prev => !prev)
            }}
            size="sm"
            variant="ghost"
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl text-xs font-normal"
          >
            Perf {showPerfOverlay ? 'On' : 'Off'}
          </Button>
        ) : null}
        <Button
          onClick={() => {
            if (!workerClient) return
            setRestorePopupVisible(true)
          }}
          size="sm"
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl text-xs font-normal"
          disabled={!hasWorker}
        >
          Restore
        </Button>
      </div>
    </Card>
  )
}
