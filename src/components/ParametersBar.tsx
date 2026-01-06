import { ChevronDown, Settings, X } from 'lucide-react'
import { type JSX, useEffect, useState } from 'react'
import { Color as ThreeColor } from 'three'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import ParameterLabel from './ParameterComponents/ParameterLabel'
import type { SimulationParams } from './SimulationParams'

export default function ParametersBar(props: {
  params: SimulationParams
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>
  onOpenChange?: (open: boolean) => void
}): JSX.Element {
  const [open, setOpen] = useState<boolean>(false)
  const [controlDifficulty, setControlDifficulty] = useState<'easy' | 'expert'>(
    'expert',
  )

  const setParams = props.setParams

  useEffect(() => {
    props.onOpenChange?.(open)
  }, [open, props])

  return (
    <>
      {/* Toggle button - always visible */}
      <Button
        onClick={() => setOpen(!open)}
        variant="outline"
        size="icon"
        className="absolute top-[calc(var(--header-height)+6px)] left-4 z-40 h-10 w-10 rounded-full bg-[#142c3f]/70 text-white/80 backdrop-blur-md hover:bg-[#1c3950]/80 border-white/10 shadow-[var(--shadow-md)] transition-transform duration-300 hover:scale-105"
        aria-label="Toggle parameters panel"
        aria-expanded={open}
        aria-controls="parameters-panel"
      >
        <Settings className="h-5 w-5 opacity-80" />
      </Button>

      {/* Parameters panel */}
      <div
        id="parameters-panel"
        className={`absolute top-0 left-0 h-full w-[var(--sidebar-width)] bg-[#142c3f]/85 backdrop-blur-xl border-r border-white/10 text-white transition-transform duration-300 z-40 shadow-[var(--shadow-xl)] ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 px-4 pb-8 pt-[calc(var(--header-height)+var(--spacing-3))]">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold tracking-tight text-white/90">
                Parameters
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.24em] text-white/40">
                  {controlDifficulty}
                </span>
                <Button
                  onClick={() => setOpen(false)}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                  aria-label="Close parameters panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mode Toggle */}
            <Card
              size="sm"
              className="bg-[#0f2234]/70 text-white ring-white/10 shadow-[var(--shadow-sm)]"
            >
              <CardHeader className="border-b border-white/10 py-3">
                <CardTitle className="text-sm font-semibold text-white/80">
                  Control Mode
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <ToggleGroup
                  type="single"
                  value={controlDifficulty}
                  onValueChange={value => {
                    if (!value || value.length === 0) return
                    // @base-ui/react returns an array, get the first (and only) value
                    const selectedValue = Array.isArray(value)
                      ? value[0]
                      : value
                    setControlDifficulty(selectedValue as 'easy' | 'expert')
                  }}
                  size="sm"
                  className="w-full rounded-lg bg-black/20 p-1"
                >
                  <ToggleGroupItem
                    value="easy"
                    className="flex-1 text-[11px] text-white/60 aria-pressed:bg-[#00a9ce] aria-pressed:text-white data-[state=on]:bg-[#00a9ce] data-[state=on]:text-white hover:text-white hover:bg-white/5"
                  >
                    Easy mode
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="expert"
                    className="flex-1 text-[11px] text-white/60 aria-pressed:bg-[#00a9ce] aria-pressed:text-white data-[state=on]:bg-[#00a9ce] data-[state=on]:text-white hover:text-white hover:bg-white/5"
                  >
                    Expert mode
                  </ToggleGroupItem>
                </ToggleGroup>
              </CardContent>
            </Card>

            {/* Simulation Color */}
            <Card
              size="sm"
              className="bg-[#0f2234]/70 text-white ring-white/10 shadow-[var(--shadow-sm)]"
            >
              <CardHeader className="border-b border-white/10 py-3">
                <CardTitle className="text-sm font-semibold text-white/80">
                  Simulation Colour
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <SimulationColour
                  params={props.params}
                  setParams={props.setParams}
                />
              </CardContent>
            </Card>

            {/* Rendering */}
            <Card
              size="sm"
              className="bg-[#0f2234]/70 text-white ring-white/10 shadow-[var(--shadow-sm)]"
            >
              <CardHeader className="border-b border-white/10 py-3">
                <CardTitle className="text-sm font-semibold text-white/80">
                  Rendering
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                <div className="space-y-2">
                  <ParameterLabel title="Rendering mode" />
                  <ToggleGroup
                    type="single"
                    value={props.params.renderHeightMap ? 'height' : 'flat'}
                    onValueChange={value => {
                      console.log(
                        '[ToggleGroup] onValueChange called with:',
                        value,
                      )
                      if (!value || value.length === 0) return
                      // @base-ui/react returns an array, get the first (and only) value
                      const selectedValue = Array.isArray(value)
                        ? value[0]
                        : value
                      const isHeight = selectedValue === 'height'
                      console.log(
                        '[ToggleGroup] selectedValue:',
                        selectedValue,
                        'isHeight:',
                        isHeight,
                      )
                      setParams(prev => {
                        console.log(
                          '[ToggleGroup] prev.renderHeightMap:',
                          prev.renderHeightMap,
                        )
                        const newParams = {
                          ...prev,
                          renderHeightMap: isHeight,
                          isCameraControlMode: isHeight
                            ? prev.isCameraControlMode
                            : false,
                        }
                        console.log(
                          '[ToggleGroup] newParams.renderHeightMap:',
                          newParams.renderHeightMap,
                        )
                        return newParams
                      })
                    }}
                    size="sm"
                    className="w-full rounded-lg bg-black/20 p-1"
                  >
                    <ToggleGroupItem
                      value="flat"
                      className="flex-1 text-[11px] text-white/60 aria-pressed:bg-[#00a9ce] aria-pressed:text-white data-[state=on]:bg-[#00a9ce] data-[state=on]:text-white hover:text-white hover:bg-white/5"
                    >
                      Flat
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="height"
                      className="flex-1 text-[11px] text-white/60 aria-pressed:bg-[#00a9ce] aria-pressed:text-white data-[state=on]:bg-[#00a9ce] data-[state=on]:text-white hover:text-white hover:bg-white/5"
                    >
                      Height Map
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-2">
                  <ParameterLabel title="Renderer Backend" />
                  <ToggleGroup
                    type="single"
                    value={props.params.rendererBackend}
                    onValueChange={value => {
                      if (!value || value.length === 0) return
                      // @base-ui/react returns an array, get the first (and only) value
                      const selectedValue = Array.isArray(value)
                        ? value[0]
                        : value
                      setParams(prev => ({
                        ...prev,
                        rendererBackend: selectedValue as 'webgl' | 'webgpu',
                      }))
                    }}
                    size="sm"
                    className="w-full rounded-lg bg-black/20 p-1"
                  >
                    <ToggleGroupItem
                      value="webgl"
                      className="flex-1 text-[11px] text-white/60 aria-pressed:bg-[#00a9ce] aria-pressed:text-white data-[state=on]:bg-[#00a9ce] data-[state=on]:text-white hover:text-white hover:bg-white/5"
                    >
                      WebGL
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="webgpu"
                      className="flex-1 text-[11px] text-white/60 aria-pressed:bg-[#00a9ce] aria-pressed:text-white data-[state=on]:bg-[#00a9ce] data-[state=on]:text-white hover:text-white hover:bg-white/5"
                    >
                      WebGPU
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {props.params.renderHeightMap && (
                  <>
                    <Separator className="bg-white/10" />
                    <div className="space-y-2">
                      <ParameterLabel title="Current Control" />
                      <ToggleGroup
                        type="single"
                        value={
                          props.params.isCameraControlMode ? 'camera' : 'force'
                        }
                        onValueChange={value => {
                          if (!value || value.length === 0) return
                          // @base-ui/react returns an array, get the first (and only) value
                          const selectedValue = Array.isArray(value)
                            ? value[0]
                            : value
                          setParams(prev => ({
                            ...prev,
                            isCameraControlMode: selectedValue === 'camera',
                          }))
                        }}
                        size="sm"
                        className="w-full rounded-lg bg-black/20 p-1"
                      >
                        <ToggleGroupItem
                          value="force"
                          className="flex-1 text-[11px] text-white/60 aria-pressed:bg-[#00a9ce] aria-pressed:text-white data-[state=on]:bg-[#00a9ce] data-[state=on]:text-white hover:text-white hover:bg-white/5"
                        >
                          Apply force
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="camera"
                          className="flex-1 text-[11px] text-white/60 aria-pressed:bg-[#00a9ce] aria-pressed:text-white data-[state=on]:bg-[#00a9ce] data-[state=on]:text-white hover:text-white hover:bg-white/5"
                        >
                          Spin camera
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Model Selection */}
            <Card
              size="sm"
              className="bg-[#0f2234]/70 text-white ring-white/10 shadow-[var(--shadow-sm)]"
            >
              <CardHeader className="border-b border-white/10 py-3">
                <CardTitle className="text-sm font-semibold text-white/80">
                  Model
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 bg-black/20 text-white px-3 py-2 rounded-lg hover:bg-black/30 transition-colors border border-white/5 outline-none text-sm">
                    <span className="font-medium">Choose Model</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#1a2c3d] border-white/10 backdrop-blur-xl text-white">
                    <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer">
                      Model 1
                    </DropdownMenuItem>
                    <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer">
                      Model 2
                    </DropdownMenuItem>
                    <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer">
                      Model 3
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>

            {/* Initial State Selection */}
            <Card
              size="sm"
              className="bg-[#0f2234]/70 text-white ring-white/10 shadow-[var(--shadow-sm)]"
            >
              <CardHeader className="border-b border-white/10 py-3">
                <CardTitle className="text-sm font-semibold text-white/80">
                  Initial State
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 bg-black/20 text-white px-3 py-2 rounded-lg hover:bg-black/30 transition-colors border border-white/5 outline-none text-sm">
                    <span className="font-medium">Choose Initial State</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#1a2c3d] border-white/10 backdrop-blur-xl text-white">
                    <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer">
                      State 1
                    </DropdownMenuItem>
                    <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer">
                      State 2
                    </DropdownMenuItem>
                    <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer">
                      State 3
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </>
  )
}

// allows the user to change the colour of the simulation
function SimulationColour(props: {
  params: SimulationParams
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>
}): JSX.Element {
  const setParams = props.setParams
  const initialColorLow = props.params.densityLowColour.getHexString()
  const initialColorHigh = props.params.densityHighColour.getHexString()
  const [colorLow, setColorLow] = useState<string>(`#${initialColorLow}`)
  const [colorHigh, setColorHigh] = useState<string>(`#${initialColorHigh}`)

  useEffect(() => {
    setParams(prev => {
      return {
        ...prev,
        densityLowColour: new ThreeColor(colorLow),
        densityHighColour: new ThreeColor(colorHigh),
      }
    })
  }, [colorLow, colorHigh, setParams])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/70 font-medium">Low Density</span>
        <ColorPicker value={colorLow} onChange={setColorLow} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-white/70 font-medium">High Density</span>
        <ColorPicker value={colorHigh} onChange={setColorHigh} />
      </div>

      {/* Gradient preview */}
      <div
        className="h-3 w-full rounded-md border border-white/10 shadow-inner mt-1"
        style={{
          background: `linear-gradient(to right, ${colorLow}, ${colorHigh})`,
        }}
      />
    </div>
  )
}
