import { HexColorPicker } from "react-colorful"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  className?: string
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "w-8 h-8 rounded border-2 border-white/20 shadow-sm cursor-pointer hover:scale-105 transition-transform",
          className
        )}
        style={{ backgroundColor: value }}
        aria-label={`Change color, current color is ${value}`}
      />
      <PopoverContent className="w-auto p-3" align="start">
        <HexColorPicker color={value} onChange={onChange} className="w-full" />
      </PopoverContent>
    </Popover>
  )
}
