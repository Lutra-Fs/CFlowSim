import { CircleHelp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export default function ParameterLabel(props: {
  title: string
  tooltip?: string
}): JSX.Element {
  const tooltip: JSX.Element[] = []
  if (props.tooltip !== undefined) {
    tooltip.push(
      <Tooltip>
        <TooltipTrigger>
          <CircleHelp className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="font-normal">
          {props.tooltip}
        </TooltipContent>
      </Tooltip>,
    )
  }

  return (
    <div className="flex h-full items-center font-bold">
      {props.title}&nbsp;&nbsp;{tooltip}
    </div>
  )
}
