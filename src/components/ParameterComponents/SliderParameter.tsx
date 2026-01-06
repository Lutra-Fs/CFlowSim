import { useState, type JSX } from 'react';

export default function SliderParameter(props: {
  onChange: (value: number) => void
  lowerBound: number
  upperBound: number
  initValue?: number
}): JSX.Element {
  const [value, setValue] = useState(props.lowerBound)
  if (props.initValue !== undefined) {
    setValue(props.initValue)
  }

  return (
    <input
      type="range"
      min={props.lowerBound}
      max={props.upperBound}
      defaultValue={value}
      onChange={e => {
        const val = parseFloat(e.target.value)
        setValue(val)
        props.onChange(val)
      }}
      className="block w-[15rem] h-6 my-1 mx-0 appearance-none -webkit-appearance-none bg-transparent cursor-pointer [&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:bg-[rgb(217,217,217)] [&::-webkit-slider-runnable-track]:h-full [&::-moz-range-track]:appearance-none [&::-moz-range-track]:bg-[rgb(217,217,217)] [&::-moz-range-track]:h-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-[rgb(32,32,32)] [&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:border-none [&::-webkit-slider-thumb]:rounded-none [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:bg-[rgb(32,32,32)] [&::-moz-range-thumb]:h-full [&::-moz-range-thumb]:w-[10px] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-none"
    />
  )
}
