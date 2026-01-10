import type { JSX } from 'react'
import ReactMarkdown from 'react-markdown'
import readmeContent from '../../README.md?raw'
import { useTheme } from '../contexts/ThemeContext'

export default function AboutPage(): JSX.Element {
  const { lightTheme } = useTheme()

  return (
    <div
      className={`h-full text-justify mx-[20%] mb-[5%] font-['Roboto',sans-serif] overflow-y-auto [&_a]:no-underline [&_a]:hover:underline [&_a]:active:underline ${
        lightTheme ? 'bg-white text-[#333333]' : 'bg-[#707070] text-[#c9c9c9]'
      }`}
    >
      <ReactMarkdown>{readmeContent}</ReactMarkdown>
    </div>
  )
}
