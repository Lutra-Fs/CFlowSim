import { type JSX, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTheme } from '../contexts/ThemeContext'

interface NavBarProps {
  setCurThemeMode: (mode: 'auto' | 'light' | 'dark') => void
  setPage: React.Dispatch<React.SetStateAction<number>>
}

export default function NavBar(props: NavBarProps): JSX.Element {
  const { setCurThemeMode, setPage } = props
  const [isShowExtend, setIsShowExtend] = useState(false)
  const { lightTheme } = useTheme()

  return (
    <header
      className={`flex items-center h-16 w-full px-8 gap-6 justify-between transition-all duration-300 border-b border-white/10 backdrop-blur-md relative z-50 ${
        lightTheme
          ? 'bg-[#004b87]/90 text-white shadow-lg'
          : 'bg-[#142c3f]/90 text-[#9faee5] shadow-lg'
      }`}
    >
      <a
        href="/"
        className="flex items-center gap-3 text-current no-underline hover:opacity-90 transition-opacity"
      >
        <img
          src="/physics.svg"
          alt="Physics in the Browser Logo"
          width={50}
          height={50}
          className="relative w-10 h-10 invert object-contain"
        />
        <div
          className="text-4xl tracking-wide leading-none -translate-y-[3px]"
          style={{ fontFamily: '"Darumadrop One", cursive' }}
        >
          CFlowSim
        </div>
      </a>

      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => {
          setIsShowExtend(curr => !curr)
        }}
        className="inline flex items-center justify-center w-10 h-10 text-white text-2xl cursor-pointer md:hidden hover:bg-white/10 rounded-lg transition-colors"
        aria-label={isShowExtend ? 'Close main menu' : 'Open main menu'}
        aria-expanded={isShowExtend}
        aria-controls="mobile-menu"
      >
        {isShowExtend ? <>&#10005;</> : <>&#8803;</>}
      </button>

      {/* Desktop navigation */}
      <nav
        className="hidden md:flex flex-row items-center gap-2"
        aria-label="Main navigation"
      >
        <Button
          onClick={() => {
            setPage(0)
          }}
          className="text-[#eeeeee] bg-[#00a9ce] hover:bg-[#0097b8] h-10 px-6 font-medium tracking-wide shadow-md hover:shadow-lg transition-all"
        >
          Simulations
        </Button>
        <Button
          onClick={() => {
            setPage(1)
          }}
          className="text-[#eeeeee] bg-[#00a9ce] hover:bg-[#0097b8] h-10 px-6 font-medium tracking-wide shadow-md hover:shadow-lg transition-all"
        >
          About
        </Button>
        <div className="w-px h-6 bg-white/20 mx-2" />
        <button
          type="button"
          onClick={() => {
            setCurThemeMode('light')
          }}
          aria-pressed={lightTheme}
          className="font-mono text-xs font-semibold text-black bg-[#f3f3f3] hover:bg-white h-9 px-4 rounded-md shadow-sm transition-all aria-pressed:ring-2 aria-pressed:ring-offset-2 aria-pressed:ring-[#00a9ce]"
        >
          Light
        </button>
        <button
          type="button"
          onClick={() => {
            setCurThemeMode('dark')
          }}
          aria-pressed={!lightTheme}
          className="font-mono text-xs font-semibold text-black bg-[#f3f3f3] hover:bg-white h-9 px-4 rounded-md shadow-sm transition-all text-opacity-60 hover:text-opacity-100 aria-pressed:ring-2 aria-pressed:ring-offset-2 aria-pressed:ring-[#00a9ce] aria-pressed:text-opacity-100"
        >
          Dark
        </button>
      </nav>

      {/* Mobile navigation */}
      {isShowExtend ? (
        <nav
          id="mobile-menu"
          aria-label="Mobile navigation"
          className="flex flex-col items-center gap-3 w-40 p-4 absolute top-20 right-4 bg-[#142c3f]/95 backdrop-blur-md rounded-xl shadow-xl border border-white/10 md:hidden z-50"
        >
          <Button
            onClick={() => {
              setPage(0)
            }}
            className="text-[#eeeeee] bg-[#00a9ce] w-full shadow-sm"
          >
            Simulations
          </Button>
          <Button
            onClick={() => {
              setPage(1)
            }}
            className="text-[#eeeeee] bg-[#00a9ce] w-full shadow-sm"
          >
            About
          </Button>
          <div className="w-full h-px bg-white/10 my-1" />
          <button
            type="button"
            onClick={() => {
              setCurThemeMode('light')
            }}
            aria-pressed={lightTheme}
            className="font-mono text-xs w-full py-2 bg-[#f3f3f3] text-black rounded-md aria-pressed:ring-2 aria-pressed:ring-offset-2 aria-pressed:ring-[#00a9ce]"
          >
            Light
          </button>
          <button
            type="button"
            onClick={() => {
              setCurThemeMode('dark')
            }}
            aria-pressed={!lightTheme}
            className="font-mono text-xs w-full py-2 bg-[#f3f3f3] text-black rounded-md aria-pressed:ring-2 aria-pressed:ring-offset-2 aria-pressed:ring-[#00a9ce]"
          >
            Dark
          </button>
        </nav>
      ) : null}
    </header>
  )
}
