import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ColorPicker } from '@/components/ui/color-picker'
import { useEffect, useState } from 'react'
import { Color as ThreeColor } from 'three'
import ParameterButton from './ParameterComponents/ParameterButton'
import ParameterLabel from './ParameterComponents/ParameterLabel'
import type { SimulationParams } from './Simulation'

function ShowHideButton(props: {
  isVisible: boolean
  setVisible: (inp: boolean) => void
}): JSX.Element {
  const isVisible = props.isVisible
  const setVisible = props.setVisible

  return (
    <button
      onClick={() => {
        setVisible(!isVisible)
      }}
      className={`absolute top-2 w-[2.75rem] h-[2.75rem] rounded-full bg-[#d9d9d9] text-[#464646] text-base border-none cursor-pointer z-[100] transition-all duration-500 ${
        isVisible ? 'left-[22.5rem]' : 'left-2'
      }`}
    >
      {isVisible ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  )
}

// whether the pane is in expert or easy mode
enum ControlDifficulty {
  Easy,
  Expert,
}

export default function ParametersBar(props: {
  params: SimulationParams
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>
}): JSX.Element {
  const [containerVisible, setContainerVisible] = useState<boolean>(true)

  // for ease of development, we'll default to expert mode for now
  const [controlDifficulty, setControlDifficulty] = useState<ControlDifficulty>(
    ControlDifficulty.Expert,
  )

  const setParams = props.setParams
  const [renderHeightMap, setRenderHeightMap] = useState(
    props.params.renderHeightMap,
  )
  // try to get the render height map from the params first
  const [isCameraControlMode, setIsCameraControlMode] = useState(
    props.params.isCameraControlMode,
  )

  useEffect(() => {
    setParams(prev => {
      return {
        ...prev,
        renderHeightMap,
        isCameraControlMode,
      }
    })
  }, [renderHeightMap, isCameraControlMode, setParams])

  return (
    <div className={`absolute w-[22rem] h-[calc(100%-5rem)] text-2xl flex z-1 ${containerVisible ? '' : 'hidden'} max-[760px]:hidden`}>
      <ShowHideButton
        isVisible={containerVisible}
        setVisible={setContainerVisible}
      />
      <div
        className={`bg-[#797979] text-white w-[20rem] h-[calc(100%-25px)] text-2xl absolute rounded-tr-[20px] rounded-br-[20px] flex flex-col gap-4 p-3 max-[760px]:hidden ${
          containerVisible ? 'left-0 visible' : 'left-[-20rem] invisible'
        } transition-all duration-500`}
      >
        {/* hide button */}
        <div className="flex justify-end"></div>

        {/* header */}
        <span className="font-['Roboto',sans-serif] text-2xl max-[760px]:hidden">
          Parameters
        </span>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <ParameterButton
              label="Easy mode"
              onClick={() => {
                setControlDifficulty(ControlDifficulty.Easy)
              }}
            />
          </div>
          <div>
            <ParameterButton
              label="Expert mode"
              onClick={() => {
                setControlDifficulty(ControlDifficulty.Expert)
              }}
            />
          </div>
        </div>

        {/* render the correct pane based on current control difficulty */}
        {
          // add all easy controls here
          controlDifficulty === ControlDifficulty.Easy && null
        }

        {
          // add all expert controls here
          controlDifficulty === ControlDifficulty.Expert && null
        }
        {/* add controls to be shown to both here */}
        <SimulationColour params={props.params} setParams={props.setParams} />

        <div className="gap-4">
          <ParameterLabel title="Rendering mode"></ParameterLabel>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <ParameterButton
              label="Flat surface"
              onClick={() => {
                setIsCameraControlMode(false)
                setRenderHeightMap(false)
              }}
            />
          </div>
          <div>
            <ParameterButton
              label="Height map"
              onClick={() => {
                setRenderHeightMap(true)
              }}
            />
          </div>
        </div>
        <div className="gap-4" style={renderHeightMap ? {} : { display: 'none' }}>
          <ParameterLabel title="Current Control"></ParameterLabel>
        </div>
        <div className="grid grid-cols-2 gap-4" style={renderHeightMap ? {} : { display: 'none' }}>
          <div>
            <ParameterButton
              label="Apply force"
              onClick={() => {
                setIsCameraControlMode(false)
              }}
            />
          </div>
          <div>
            <ParameterButton
              label="Spin camera"
              onClick={() => {
                setIsCameraControlMode(true)
              }}
            />
          </div>
        </div>
        {/* choose initial model */}
        <DropdownMenu>
          <DropdownMenuTrigger className="font-['Roboto',sans-serif] text-base text-black flex items-center gap-1 cursor-pointer border-none bg-transparent p-0">
            Choose Model
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>1st menu item</DropdownMenuItem>
            <DropdownMenuItem>2nd menu item</DropdownMenuItem>
            <DropdownMenuItem>3rd menu item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* choose initial state */}
        <DropdownMenu>
          <DropdownMenuTrigger className="font-['Roboto',sans-serif] text-base text-black flex items-center gap-1 cursor-pointer border-none bg-transparent p-0">
            Choose Initial State
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>1st menu item</DropdownMenuItem>
            <DropdownMenuItem>2nd menu item</DropdownMenuItem>
            <DropdownMenuItem>3rd menu item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// CATEGORIES

// allows the user to change the colour of the simulation
function SimulationColour(props: {
  params: SimulationParams
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>
}): JSX.Element {
  const setParams = props.setParams
  // turn the colours into strings for the colour picker
  const initialColorLow = props.params.densityLowColour.getHexString()
  const initialColorHigh = props.params.densityHighColour.getHexString()
  const [colorLow, setColorLow] = useState<string>(
    '#' + initialColorLow,
  )
  const [colorHigh, setColorHigh] = useState<string>(
    '#' + initialColorHigh,
  )

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
    <Card className="font-['Roboto',sans-serif] bg-[#797979] text-left text-base text-white border-0">
      <CardHeader className="bg-[#797979] text-white p-3 pb-2">
        <CardTitle className="text-white">Simulation Colour</CardTitle>
      </CardHeader>
      <CardContent className="bg-[#797979] text-white p-3 pt-2">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <ParameterLabel
              title="Low"
              tooltip="The colour to shade points of low density"
            />
          </div>
          <div>
            <ColorPicker value={colorLow} onChange={setColorLow} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <ParameterLabel
              title="High"
              tooltip="The colour to shade points of high density"
            />
          </div>
          <div>
            <ColorPicker value={colorHigh} onChange={setColorHigh} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
