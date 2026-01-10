import { ChevronLeft, Settings2 } from 'lucide-react'
import { type JSX, useEffect, useState } from 'react'
import { Color as ThreeColor } from 'three'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type InitDataConfig,
  type InitDataItem,
  loadInitDataConfig,
  parseInitStateId,
} from '@/services/initData/initDataService'
import type { SimulationParams } from './SimulationParams'

export default function ParametersBarNew(props: {
  params: SimulationParams
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>
  onOpenChange?: (open: boolean) => void
  currentInitStateId?: string
  onInitStateChange?: (item: InitDataItem) => void
}): JSX.Element {
  const [open, setOpen] = useState<boolean>(false)
  const [initDataConfig, setInitDataConfig] = useState<InitDataConfig | null>(
    null,
  )
  const [initDataLoading, setInitDataLoading] = useState(true)

  const { params, setParams } = props

  useEffect(() => {
    loadInitDataConfig()
      .then(config => {
        setInitDataConfig(config)
        setInitDataLoading(false)
      })
      .catch(error => {
        console.error('Failed to load initData config', error)
        setInitDataLoading(false)
      })
  }, [])

  useEffect(() => {
    props.onOpenChange?.(open)
  }, [open, props.onOpenChange])

  return (
    <>
      {/* Floating Toggle Button */}
      <div
        className={`absolute top-24 left-6 z-40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open
            ? 'translate-x-[280px] opacity-0 pointer-events-none'
            : 'translate-x-0'
        }`}
      >
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="h-10 w-10 rounded-full bg-[#142c3f]/80 text-white backdrop-blur-md border border-white/10 shadow-xl hover:bg-[#1c3950] hover:scale-105 transition-all"
          aria-label="Open parameters"
        >
          <Settings2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar Panel */}
      <aside
        className={`absolute top-0 left-0 h-full w-[320px] bg-[#0f172a]/95 backdrop-blur-xl border-r border-white/5 shadow-2xl z-40 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2 border-b border-white/5">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Parameters
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure simulation engine
            </p>
          </div>
          <Button
            onClick={() => setOpen(false)}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5 rounded-full"
            aria-label="Close parameters"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-8 pb-10">
            {/* Control Mode */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Control Mode
              </Label>
              <Tabs defaultValue="expert" className="w-full">
                <TabsList className="w-full bg-slate-800/50 p-1 border border-white/5">
                  <TabsTrigger value="easy" className="flex-1 text-xs">
                    Easy
                  </TabsTrigger>
                  <TabsTrigger value="expert" className="flex-1 text-xs">
                    Expert
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Separator className="bg-white/5" />

            {/* Model & State */}
            <div className="space-y-4">
              <Label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Model Configuration
              </Label>

              <div className="space-y-2">
                <Label className="text-sm text-slate-300">Physics Model</Label>
                <Select>
                  <SelectTrigger className="w-full bg-slate-800/50 border-white/10 text-slate-200">
                    <SelectValue placeholder="Select Model" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-white/10 text-slate-200">
                    <SelectItem value="model1">Default Model</SelectItem>
                    <SelectItem value="model2">Experimental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-300">Initial State</Label>
                <Select
                  disabled={initDataLoading}
                  value={props.currentInitStateId}
                  onValueChange={val => {
                    if (!initDataConfig) return
                    const parsed = parseInitStateId(val)
                    if (!parsed) return
                    const category = initDataConfig.categories.find(
                      c => c.id === parsed.categoryId,
                    )
                    const item = category?.items.find(
                      i => i.id === parsed.itemId,
                    )
                    if (item && props.onInitStateChange) {
                      props.onInitStateChange(item)
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-slate-800/50 border-white/10 text-slate-200">
                    <SelectValue
                      placeholder={
                        initDataLoading ? 'Loading...' : 'Choose State'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-white/10 text-slate-200">
                    {initDataConfig?.categories.map(category => (
                      <div key={category.id}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">
                          {category.name}
                        </div>
                        {category.items.map(item => (
                          <SelectItem
                            key={`${category.id}:${item.id}`}
                            value={`${category.id}:${item.id}`}
                          >
                            {item.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Rendering Options */}
            <div className="space-y-4">
              <Label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Visualisation
              </Label>

              <div className="flex items-center justify-between">
                <Label className="text-sm text-slate-300">Height Map</Label>
                <Switch
                  checked={params.renderHeightMap}
                  onCheckedChange={checked => {
                    setParams(prev => ({
                      ...prev,
                      renderHeightMap: checked,
                      isCameraControlMode: checked
                        ? prev.isCameraControlMode
                        : false,
                    }))
                  }}
                  className="data-[state=checked]:bg-[#00a9ce]"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm text-slate-300">Use WebGPU</Label>
                <Switch
                  checked={params.rendererBackend === 'webgpu'}
                  onCheckedChange={checked => {
                    setParams(prev => ({
                      ...prev,
                      rendererBackend: checked ? 'webgpu' : 'webgl',
                    }))
                  }}
                  className="data-[state=checked]:bg-[#00a9ce]"
                />
              </div>

              {params.renderHeightMap && (
                <div className="bg-slate-800/30 p-3 rounded-lg border border-white/5 space-y-3">
                  <Label className="text-xs text-slate-400">
                    Interaction Mode
                  </Label>
                  <Tabs
                    value={params.isCameraControlMode ? 'camera' : 'force'}
                    onValueChange={v => {
                      setParams(prev => ({
                        ...prev,
                        isCameraControlMode: v === 'camera',
                      }))
                    }}
                    className="w-full"
                  >
                    <TabsList className="w-full bg-slate-800 p-1 h-8">
                      <TabsTrigger
                        value="force"
                        className="flex-1 text-[10px] h-6"
                      >
                        Apply Force
                      </TabsTrigger>
                      <TabsTrigger
                        value="camera"
                        className="flex-1 text-[10px] h-6"
                      >
                        Orbit Camera
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Label className="text-sm text-slate-300">Fluid Colors</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-500">Low Density</span>
                    <ColorPicker
                      value={`#${params.densityLowColour.getHexString()}`}
                      onChange={c => {
                        setParams(p => ({
                          ...p,
                          densityLowColour: new ThreeColor(c),
                        }))
                      }}
                      className="w-full h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-500">High Density</span>
                    <ColorPicker
                      value={`#${params.densityHighColour.getHexString()}`}
                      onChange={c => {
                        setParams(p => ({
                          ...p,
                          densityHighColour: new ThreeColor(c),
                        }))
                      }}
                      className="w-full h-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </aside>
    </>
  )
}
