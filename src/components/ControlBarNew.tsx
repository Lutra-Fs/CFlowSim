import {
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
  Upload,
} from 'lucide-react'
import { type JSX, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ModelSave } from '../services/model/modelService'
import type { ModelWorkerClient } from '../workers/workerClient'

interface ControlBarProps {
  workerClient: ModelWorkerClient | null
  setRestorePopupVisible: React.Dispatch<React.SetStateAction<boolean>>
  showPerfOverlay: boolean
  setShowPerfOverlay: React.Dispatch<React.SetStateAction<boolean>>
}

export default function ControlBarNew(props: ControlBarProps): JSX.Element {
  const {
    workerClient,
    setRestorePopupVisible,
    showPerfOverlay,
    setShowPerfOverlay,
  } = props
  const hasWorker = workerClient !== null

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
    <div className="absolute bottom-8 left-0 right-0 flex justify-center z-40 pointer-events-none px-4">
      <div className="flex items-center gap-2 p-2 bg-[#142c3f]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto ring-1 ring-white/5">
        <TooltipProvider delayDuration={300}>
          {/* Main Playback Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => workerClient?.start()}
                  size="icon"
                  className="w-12 h-12 rounded-xl bg-[#00a9ce] hover:bg-[#0097b8] text-white shadow-lg shadow-[#00a9ce]/20 hover:scale-105 active:scale-95 transition-all"
                  disabled={!hasWorker}
                  aria-label="Play simulation"
                >
                  <Play className="w-5 h-5 fill-current" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Play Simulation</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => workerClient?.pause()}
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
                  disabled={!hasWorker}
                  aria-label="Pause"
                >
                  <Pause className="w-5 h-5 fill-current" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pause</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => console.log('Stop clicked')}
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
                  aria-label="Stop"
                >
                  <Square className="w-4 h-4 fill-current" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-8 bg-white/10 mx-1" />

          {/* Secondary Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => workerClient?.terminate()}
                  size="icon"
                  variant="ghost"
                  className="w-9 h-9 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-500/10"
                  disabled={!hasWorker}
                  aria-label="Reset simulation"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset Simulation</TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSave}
                  size="icon"
                  variant="ghost"
                  className="w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                  disabled={!hasWorker}
                  aria-label="Save state"
                >
                  <Save className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save State</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => workerClient && setRestorePopupVisible(true)}
                  size="icon"
                  variant="ghost"
                  className="w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                  disabled={!hasWorker}
                  aria-label="Restore state"
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restore State</TooltipContent>
            </Tooltip>

            {import.meta.env.DEV && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowPerfOverlay(prev => !prev)}
                    size="icon"
                    variant="ghost"
                    className={`w-9 h-9 rounded-lg transition-colors ${
                      showPerfOverlay
                        ? 'text-[#00a9ce] bg-[#00a9ce]/10'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    aria-label="Toggle performance overlay"
                  >
                    <Gauge className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Performance Overlay</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
