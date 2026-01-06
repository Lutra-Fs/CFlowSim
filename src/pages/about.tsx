import { ReactComponent } from '../../README.md'
import { useTheme } from '../contexts/ThemeContext'

import type { JSX } from "react";

export default function AboutPage(): JSX.Element {
  const { lightTheme } = useTheme()

  return (
    <div
      className={`text-justify mx-[20%] mb-[5%] font-['Roboto',sans-serif] [&_a]:no-underline [&_a]:hover:underline [&_a]:active:underline ${
        lightTheme ? 'bg-white text-[#333333]' : 'bg-[#707070] text-[#c9c9c9]'
      }`}
    >
      <ReactComponent />
    </div>
  )
}
