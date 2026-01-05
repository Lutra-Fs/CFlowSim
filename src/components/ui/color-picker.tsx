import { HexColorPicker } from "react-colorful"
import { cn } from "@/lib/utils"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  className?: string
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn("w-full", className)}>
      <HexColorPicker color={value} onChange={onChange} className="w-full h-40" />
    </div>
  )
}
