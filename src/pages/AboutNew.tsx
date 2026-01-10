import type { JSX } from 'react'
import ReactMarkdown from 'react-markdown'
import { Card } from '@/components/ui/card'
import readmeContent from '../../README.md?raw'
import { useTheme } from '../contexts/ThemeContext'

export default function AboutPageNew(): JSX.Element {
  const { lightTheme } = useTheme()

  return (
    <div
      className={`h-full w-full overflow-y-auto px-6 py-24 md:py-32 transition-colors duration-300 ${
        lightTheme ? 'bg-[#f8fafc]' : 'bg-[#0f172a]'
      }`}
    >
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card
          className={`p-8 md:p-12 shadow-2xl border-0 ${
            lightTheme
              ? 'bg-white/80 ring-1 ring-black/5'
              : 'bg-[#1e293b]/50 ring-1 ring-white/10'
          } backdrop-blur-xl`}
        >
          <article
            className={`prose prose-lg max-w-none ${
              lightTheme
                ? 'prose-slate prose-headings:text-[#004b87] prose-a:text-[#00a9ce]'
                : 'prose-invert prose-headings:text-sky-100 prose-a:text-[#00a9ce] prose-p:text-slate-300'
            }`}
          >
            <ReactMarkdown>{readmeContent}</ReactMarkdown>
          </article>
        </Card>

        <div className="mt-12 text-center">
          <p
            className={`text-sm ${lightTheme ? 'text-slate-400' : 'text-slate-600'}`}
          >
            © {new Date().getFullYear()} CFlowSim • Neural Physics Engine
          </p>
        </div>
      </div>
    </div>
  )
}
