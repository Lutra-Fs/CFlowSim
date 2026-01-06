import { type JSX, useEffect, useState } from 'react'
import NavBar from './components/NavBar'

import './styles/main.css'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import Home from './pages'
import AboutPage from './pages/about'
import {
  type IncomingMessage,
  type InitArgs,
  RunnerFunc,
} from './workers/modelWorkerMessage'

function AppContent(): JSX.Element {
  // save the current page in state
  // 0 = home(index,simulation) 1 = about
  const [page, setPage] = useState(0)

  const [simWorker, setSimWorker] = useState<Worker | null>(null)
  useEffect(() => {
    const worker = new Worker(
      new URL('./workers/modelWorker', import.meta.url),
      {
        type: 'module',
      },
    )
    setSimWorker(worker)

    return () => {
      worker.terminate()
    }
  }, [])

  useEffect(() => {
    const message: IncomingMessage = {
      func: RunnerFunc.INIT,
      args: {
        modelPath: '/model/bno_small_001.onnx',
        initConditionPath:
          '/initData/pvf_incomp_44_nonneg/pvf_incomp_44_nonneg_0.json',
      } satisfies InitArgs,
    }
    if (simWorker === null) return
    simWorker.postMessage(message)
  }, [simWorker])

  const { setThemeMode } = useTheme()

  const isHomeActive = page === 0

  return (
    <main className="flex flex-col w-screen h-screen bg-gray-700 data-[theme-light]:bg-white overflow-hidden">
      <NavBar setPage={setPage} setCurThemeMode={setThemeMode} />
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <div
          className={`absolute inset-0 ${isHomeActive ? '' : 'pointer-events-none opacity-0'}`}
        >
          <Home worker={simWorker} isActive={isHomeActive} />
        </div>
        {!isHomeActive ? (
          <div className="absolute inset-0">
            <AboutPage />
          </div>
        ) : null}
      </div>
    </main>
  )
}

function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
