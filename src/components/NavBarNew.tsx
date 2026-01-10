import { Activity, FlaskConical, Info, Menu, Moon, Sun } from 'lucide-react'
import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useTheme } from '../contexts/ThemeContext'

interface NavBarProps {
  setCurThemeMode: (mode: 'auto' | 'light' | 'dark') => void
  setPage: React.Dispatch<React.SetStateAction<number>>
}

export default function NavBarNew(props: NavBarProps): JSX.Element {
  const { setCurThemeMode, setPage } = props
  const { lightTheme } = useTheme()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
        {/* Brand */}
        <a
          href="/"
          className="group flex items-center gap-3 no-underline transition-transform active:scale-95"
          onClick={e => {
            e.preventDefault()
            setPage(0)
          }}
        >
          <div className="relative w-10 h-10 flex items-center justify-center bg-[#00a9ce] rounded-xl shadow-lg shadow-[#00a9ce]/20 group-hover:bg-[#0097b8] transition-colors">
            <img
              src="/physics.svg"
              alt="Logo"
              className="w-6 h-6 invert object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span
              className={`text-xl leading-none tracking-wide ${
                lightTheme ? 'text-[#004b87]' : 'text-white'
              }`}
              style={{ fontFamily: '"Darumadrop One", cursive' }}
            >
              CFlowSim
            </span>
            <span
              className={`text-[10px] font-mono uppercase tracking-wider ${
                lightTheme ? 'text-[#004b87]/60' : 'text-white/40'
              }`}
            >
              Neural Physics Engine
            </span>
          </div>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-2 p-1.5 bg-[#142c3f]/80 backdrop-blur-md border border-white/10 rounded-full shadow-xl">
          <Button
            onClick={() => setPage(0)}
            variant="ghost"
            size="sm"
            className="rounded-full hover:bg-white/10 text-white gap-2 px-4 font-medium"
          >
            <FlaskConical className="w-4 h-4 text-[#00a9ce]" />
            Simulations
          </Button>
          <Button
            onClick={() => setPage(1)}
            variant="ghost"
            size="sm"
            className="rounded-full hover:bg-white/10 text-white gap-2 px-4 font-medium"
          >
            <Info className="w-4 h-4 text-[#00a9ce]" />
            About
          </Button>

          <div className="w-px h-4 bg-white/20 mx-1" />

          <div className="flex bg-black/20 rounded-full p-1">
            <Button
              onClick={() => setCurThemeMode('light')}
              variant="ghost"
              size="icon"
              className={`w-7 h-7 rounded-full hover:bg-white/10 ${
                lightTheme
                  ? 'bg-white text-[#004b87] shadow-sm'
                  : 'text-white/60'
              }`}
              aria-label="Light mode"
            >
              <Sun className="w-3.5 h-3.5" />
            </Button>
            <Button
              onClick={() => setCurThemeMode('dark')}
              variant="ghost"
              size="icon"
              className={`w-7 h-7 rounded-full hover:bg-white/10 ${
                !lightTheme
                  ? 'bg-[#00a9ce] text-white shadow-sm'
                  : 'text-white/60'
              }`}
              aria-label="Dark mode"
            >
              <Moon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`md:hidden rounded-full backdrop-blur-md border ${
                lightTheme
                  ? 'bg-white/80 border-black/10 text-[#004b87]'
                  : 'bg-[#142c3f]/80 border-white/10 text-white'
              }`}
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className={`w-64 border-l ${
              lightTheme
                ? 'bg-white border-black/10'
                : 'bg-[#142c3f] border-white/10 text-white'
            }`}
          >
            <SheetHeader className="text-left mb-6">
              <SheetTitle
                className={`text-lg font-bold flex items-center gap-2 ${
                  lightTheme ? 'text-[#004b87]' : 'text-white'
                }`}
              >
                <Activity className="w-5 h-5 text-[#00a9ce]" />
                Menu
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setPage(0)}
                variant="ghost"
                className="justify-start gap-3 text-base h-12"
              >
                <FlaskConical className="w-4 h-4 text-[#00a9ce]" />
                Simulations
              </Button>
              <Button
                onClick={() => setPage(1)}
                variant="ghost"
                className="justify-start gap-3 text-base h-12"
              >
                <Info className="w-4 h-4 text-[#00a9ce]" />
                About
              </Button>

              <div className="my-4 h-px bg-white/10" />

              <div className="flex items-center justify-between px-4 py-2 bg-black/5 rounded-lg">
                <span className="text-sm font-medium opacity-70">Theme</span>
                <div className="flex bg-black/10 rounded-full p-1">
                  <Button
                    onClick={() => setCurThemeMode('light')}
                    variant="ghost"
                    size="icon"
                    className={`w-7 h-7 rounded-full ${
                      lightTheme ? 'bg-white shadow-sm' : 'opacity-50'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    onClick={() => setCurThemeMode('dark')}
                    variant="ghost"
                    size="icon"
                    className={`w-7 h-7 rounded-full ${
                      !lightTheme
                        ? 'bg-[#00a9ce] text-white shadow-sm'
                        : 'opacity-50'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
