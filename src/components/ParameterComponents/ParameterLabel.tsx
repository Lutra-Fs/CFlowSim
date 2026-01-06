import { CircleHelp } from 'lucide-react'
import type { JSX } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function ParameterLabel(props: {
  title: string
  tooltip?: string
}): JSX.Element {
  const tooltip: JSX.Element[] = []
  if (props.tooltip !== undefined) {
    tooltip.push(
      <Tooltip>
        <TooltipTrigger>
          <CircleHelp className="h-4 w-4 text-white/60" />
        </TooltipTrigger>
        <TooltipContent side="right" className="font-normal">
          {props.tooltip}
        </TooltipContent>
      </Tooltip>,
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-white/70">
      <span>{props.title}</span>
      {tooltip}
    </div>
  )
}
