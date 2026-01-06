import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

interface ThemeContextType {
  lightTheme: boolean
  setLightTheme: (light: boolean) => void
  themeMode: 'auto' | 'light' | 'dark'
  setThemeMode: (mode: 'auto' | 'light' | 'dark') => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [lightTheme, setLightTheme] = useState<boolean>(false)
  const [themeMode, setThemeMode] = useState<'auto' | 'light' | 'dark'>('auto')

  useEffect(() => {
    if (themeMode === 'auto') {
      const darkModeMediaQuery = window.matchMedia(
        '(prefers-color-scheme: dark)',
      )
      const handleChange = (e: MediaQueryListEvent) => setLightTheme(!e.matches)
      darkModeMediaQuery.addEventListener('change', handleChange)
      setLightTheme(!darkModeMediaQuery.matches)
      return () =>
        darkModeMediaQuery.removeEventListener('change', handleChange)
    }
    setLightTheme(themeMode === 'light')
  }, [themeMode])

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      lightTheme ? 'light' : 'dark',
    )
  }, [lightTheme])

  return (
    <ThemeContext.Provider
      value={{ lightTheme, setLightTheme, themeMode, setThemeMode }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
