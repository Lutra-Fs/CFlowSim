import type { JSX } from 'react'
export default function ParameterButton(props: {
  label: string
  onClick?: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="w-full rounded-[20px] bg-[#d9d9d9] px-5 py-[10px_20px_7px_20px] text-[14px] text-[#464646] cursor-pointer border-none"
    >
      {props.label}
    </button>
  )
}
