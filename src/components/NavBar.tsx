import { Button } from 'antd'
import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface NavBarProps {
  setCurThemeMode: (mode: 'auto' | 'light' | 'dark') => void
  setPage: React.Dispatch<React.SetStateAction<number>>
}

export default function NavBar(props: NavBarProps): React.ReactElement {
  const { setCurThemeMode, setPage } = props
  const [isShowExtend, setIsShowExtend] = useState(false)
  const { lightTheme } = useTheme()

  return (
    <header
      className={`flex items-center h-20 ${
        lightTheme ? 'bg-[#004b87] text-[#f5f5f5]' : 'bg-[#142c3f] text-[#9faee5]'
      }`}
    >
      <a
        href="/"
        className="m-4 text-[#eee] no-underline flex items-center"
      >
        <img
          src="/physics.svg"
          alt="Physics in the Browser Logo "
          width={50}
          height={50}
          className="border border-black invert relative w-[65px] h-[65px] text-[#eee]"
        />
        <div className="relative left-[1.4rem] bottom-1 font-['Darumadrop_One',cursive] text-[2.3rem]">
          CFlowSim
        </div>
      </a>
      <button
        onClick={() => {
          setIsShowExtend(curr => !curr)
        }}
        className="inline w-8 h-36 bg-none border-none text-white text-2xl absolute right-8 cursor-pointer min-[760px]:hidden"
      >
        {isShowExtend ? <>&#10005;</> : <>&#8801;</>}
      </button>

      <nav className="flex absolute right-4 flex-row items-center mr-8 max-[760px]:hidden">
        <Button
          type="primary"
          onClick={() => {
            setPage(0)
          }}
          className="text-[#eeeeee] bg-[#00a9ce] h-[3.2rem] w-[8rem] m-0 mx-1 cursor-pointer max-[760px]:mb-1"
        >
          Simulations
        </Button>
        <Button
          type="primary"
          onClick={() => {
            setPage(1)
          }}
          className="text-[#eeeeee] bg-[#00a9ce] h-[3.2rem] w-[8rem] m-0 mx-1 cursor-pointer max-[760px]:mb-1"
        >
          About
        </Button>
        <button
          onClick={() => {
            setCurThemeMode('light')
          }}
          className="font-['Source_Code_Pro',monospace] text-sm text-black bg-[#f3f3f3] h-[2.7rem] w-[4.5rem] m-0 mx-1 cursor-pointer"
        >
          Light
        </button>
        <button
          onClick={() => {
            setCurThemeMode('dark')
          }}
          className="font-['Source_Code_Pro',monospace] text-sm text-black bg-[#f3f3f3] h-[2.7rem] w-[4.5rem] m-0 mx-1 cursor-pointer"
        >
          Dark
        </button>
      </nav>
      {isShowExtend ? (
        <nav className="inline flex-col items-center w-[8.4rem] h-[15rem] absolute top-[4.5rem] right-4 mb-4 min-[760px]:hidden">
          <Button
            type="primary"
            onClick={() => {
              setPage(0)
            }}
            className="text-[#eeeeee] bg-[#00a9ce] h-[3.2rem] w-[8rem] m-0 mx-1 cursor-pointer max-[760px]:mb-1"
          >
            Simulations
          </Button>
          <Button
            type="primary"
            onClick={() => {
              setPage(1)
            }}
            className="text-[#eeeeee] bg-[#00a9ce] h-[3.2rem] w-[8rem] m-0 mx-1 cursor-pointer max-[760px]:mb-1"
          >
            About
          </Button>
          <button
            onClick={() => {
              setCurThemeMode('light')
            }}
            className="font-['Source_Code_Pro',monospace] text-sm text-black bg-[#f3f3f3] h-[2.7rem] w-[4.5rem] m-0 mx-1 cursor-pointer"
          >
            Light
          </button>
          <button
            onClick={() => {
              setCurThemeMode('dark')
            }}
            className="font-['Source_Code_Pro',monospace] text-sm text-black bg-[#f3f3f3] h-[2.7rem] w-[4.5rem] m-0 mx-1 cursor-pointer"
          >
            Dark
          </button>
        </nav>
      ) : null}
    </header>
  )
}
