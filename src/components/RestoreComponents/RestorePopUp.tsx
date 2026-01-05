import { CloseOutlined } from '@ant-design/icons'
import { Divider, Menu } from 'antd'
import { useState } from 'react'
import IndexedDBRestore from './IndexedDBRestore'
import LocalFileRestore from './LocalFileRestore'
import type { RestoreProps } from './RestoreProps'

export default function RestorePopup(props: RestoreProps): JSX.Element {
  const setRestorePopupVisible = props.setRestorePopupVisible
  const [selectedItem, setSelectedItem] = useState('')

  const handleItemClick = (item: {
    key: React.SetStateAction<string>
  }): void => {
    setSelectedItem(item.key)
  }

  const renderRightColumn = (): React.ReactNode => {
    switch (selectedItem) {
      case 'A':
        return <LocalFileRestore {...props} />
      case 'B':
        return <IndexedDBRestore {...props} />
      default:
        return null
    }
  }

  const handleCloseClick = (): void => {
    setRestorePopupVisible(false)
  }

  return (
    <div
      id="restore-popup"
      className="absolute top-1/2 left-1/2 w-[60%] h-[80%] bg-white rounded-[1rem] -translate-x-1/2 -translate-y-1/2 z-[100] max-[760px]:w-[95%] max-[760px]:h-[97%]"
    >
      <button
        onClick={handleCloseClick}
        className="absolute top-2 right-2 bg-transparent border-none text-base cursor-pointer"
      >
        <CloseOutlined />
      </button>
      <div className="float-left flex justify-center items-center w-1/4 h-full max-[760px]:w-[95%] max-[760px]:float-none max-[760px]:h-[30%]">
        <div className="w-[80%] h-[90%] overflow-hidden flex justify-center">
          <Menu
            onClick={handleItemClick}
            selectedKeys={[selectedItem]}
            className="w-full h-full border-none"
          >
            <Menu.Item key="A">Local PC</Menu.Item>
            <Menu.Item key="B">IndexedDB</Menu.Item>
          </Menu>
        </div>
      </div>
      <Divider type="vertical" />
      <div className="float-left flex justify-center items-center w-[70%] h-full max-[760px]:w-full max-[760px]:float-none max-[760px]:h-[70%]">
        <div className="w-[80%] h-[90%] overflow-hidden flex justify-center">{renderRightColumn()}</div>
      </div>
    </div>
  )
}
