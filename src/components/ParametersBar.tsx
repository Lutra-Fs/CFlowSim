import {
  DoubleLeftOutlined,
  DoubleRightOutlined,
  DownOutlined,
} from '@ant-design/icons'
import {
  Card,
  Col,
  ColorPicker,
  Dropdown,
  type MenuProps,
  message,
  Row,
  Space,
} from 'antd'
import type { Color } from 'antd/es/color-picker'
import type { SpaceSize } from 'antd/es/space'
import { useEffect, useMemo, useState } from 'react'
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
      {isVisible ? <DoubleLeftOutlined /> : <DoubleRightOutlined />}
    </button>
  )
}

// whether the pane is in expert or easy mode
enum ControlDifficulty {
  Easy,
  Expert,
}

const onClick: MenuProps['onClick'] = ({ key }) => {
  void message.info(`Click on item ${key}`)
}

const items: MenuProps['items'] = [
  {
    label: '1st menu item',
    key: '1',
  },
  {
    label: '2nd menu item',
    key: '2',
  },
  {
    label: '3rd menu item',
    key: '3',
  },
]

export default function ParametersBar(props: {
  params: SimulationParams
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>
}): JSX.Element {
  const [containerVisible, setContainerVisible] = useState<boolean>(true)
  const space: [SpaceSize, SpaceSize] = ['large', 'small']

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
      <Space
        direction="vertical"
        size={space}
        className={`bg-[#797979] text-white w-[20rem] h-[calc(100%-25px)] text-2xl absolute rounded-tr-[20px] rounded-br-[20px] p-3 max-[760px]:hidden ${
          containerVisible ? 'left-0 visible' : 'left-[-20rem] invisible'
        } transition-all duration-500`}
      >
        {/* hide button */}
        <Row justify="end"></Row>

        {/* header */}
        <span className="font-['Roboto',sans-serif] text-2xl max-[760px]:hidden">
          Parameters
        </span>
        <Row gutter={16}>
          <Col className="gutter-row" span={12}>
            <ParameterButton
              label="Easy mode"
              onClick={() => {
                setControlDifficulty(ControlDifficulty.Easy)
              }}
            />
          </Col>
          <Col className="gutter-row" span={12}>
            <ParameterButton
              label="Expert mode"
              onClick={() => {
                setControlDifficulty(ControlDifficulty.Expert)
              }}
            />
          </Col>
        </Row>

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

        <Row gutter={16}>
          <ParameterLabel title="Rendering mode"></ParameterLabel>
        </Row>
        <Row gutter={16}>
          <Col className="gutter-row" span={12}>
            <ParameterButton
              label="Flat surface"
              onClick={() => {
                setIsCameraControlMode(false)
                setRenderHeightMap(false)
              }}
            />
          </Col>
          <Col className="gutter-row" span={12}>
            <ParameterButton
              label="Height map"
              onClick={() => {
                setRenderHeightMap(true)
              }}
            />
          </Col>
        </Row>
        <Row gutter={16} style={renderHeightMap ? {} : { display: 'none' }}>
          <ParameterLabel title="Current Control"></ParameterLabel>
        </Row>
        <Row gutter={16} style={renderHeightMap ? {} : { display: 'none' }}>
          <Col className="gutter-row" span={12}>
            <ParameterButton
              label="Apply force"
              onClick={() => {
                setIsCameraControlMode(false)
              }}
            />
          </Col>
          <Col className="gutter-row" span={12}>
            <ParameterButton
              label="Spin camera"
              onClick={() => {
                setIsCameraControlMode(true)
              }}
            />
          </Col>
        </Row>
        {/* choose initial model */}
        <Dropdown menu={{ items, onClick }}>
          <a
            className="font-['Roboto',sans-serif] text-base text-black"
            onClick={e => {
              e.preventDefault()
            }}
          >
            <Space>
              Choose Model
              <DownOutlined />
            </Space>
          </a>
        </Dropdown>

        {/* choose initial state */}
        <Dropdown menu={{ items, onClick }}>
          <a
            className="font-['Roboto',sans-serif] text-base text-black"
            onClick={e => {
              e.preventDefault()
            }}
          >
            <Space>
              Choose Initial State
              <DownOutlined />
            </Space>
          </a>
        </Dropdown>
      </Space>
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
  const [colorLow, setColorLow] = useState<Color | string>(
    '#' + initialColorLow,
  )
  const [colorHigh, setColorHigh] = useState<Color | string>(
    '#' + initialColorHigh,
  )

  const colorLowString = useMemo(
    () => (typeof colorLow === 'string' ? colorLow : colorLow.toHexString()),
    [colorLow],
  )
  const colorHighString = useMemo(
    () => (typeof colorHigh === 'string' ? colorHigh : colorHigh.toHexString()),
    [colorHigh],
  )

  useEffect(() => {
    setParams(prev => {
      return {
        ...prev,
        densityLowColour: new ThreeColor(colorLowString),
        densityHighColour: new ThreeColor(colorHighString),
      }
    })
  }, [colorLowString, colorHighString, setParams])

  return (
    <Card
      title={'Simulation Colour'}
      className="font-['Roboto',sans-serif] bg-[#797979] text-left text-base text-white [&_.ant-card-head]:bg-[#797979] [&_.ant-card-head-title]:text-white [&_.ant-card-body]:bg-[#797979] [&_.ant-card-body]:text-white"
    >
      <Row justify="start" gutter={16}>
        <Col className="gutter-row" span={12}>
          <ParameterLabel
            title="Low"
            tooltip="The colour to shade points of low density"
          />
        </Col>
        <Col className="gutter-row" span={12}>
          <ColorPicker value={colorLow} onChange={setColorLow} />
        </Col>
      </Row>

      <Row justify="start" gutter={16}>
        <Col className="gutter-row" span={12}>
          <ParameterLabel
            title="High"
            tooltip="The colour to shade points of high density"
          />
        </Col>
        <Col className="gutter-row" span={12}>
          <ColorPicker value={colorHigh} onChange={setColorHigh} />
        </Col>
      </Row>
    </Card>
  )
}
