import { QuestionCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'

export default function ParameterLabel(props: {
  title: string
  tooltip?: string
}): JSX.Element {
  const tooltip: JSX.Element[] = []
  if (props.tooltip !== undefined) {
    tooltip.push(
      <Tooltip
        placement="right"
        title={props.tooltip}
        getPopupContainer={tn => tn}
        overlayClassName="[&_.ant-tooltip-inner]:font-normal [&_.ant-tooltip-inner]:text-[#cfcfcf]"
      >
        <QuestionCircleOutlined />
      </Tooltip>,
    )
  }

  return (
    <div className="flex h-full items-center font-bold">
      {props.title}&nbsp;&nbsp;{tooltip}
    </div>
  )
}
