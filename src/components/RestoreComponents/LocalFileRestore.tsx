import { Upload } from 'lucide-react'
import { type JSX, useCallback, useState } from 'react'
import {
  type IncomingMessage,
  RunnerFunc,
} from '../../workers/modelWorkerMessage'
import type { RestoreProps } from './RestoreProps'

export default function LocalFileRestore(props: RestoreProps): JSX.Element {
  const { worker } = props
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      console.log(file)
      const reader = new FileReader()
      reader.onload = e => {
        console.log(e.target?.result)
        const result = e.target?.result
        if (typeof result === 'string') {
          const msg: IncomingMessage = {
            func: RunnerFunc.DESERIALIZE,
            args: { savedState: result },
          }
          worker.postMessage(msg)
        }
      }
      reader.readAsText(file)
    },
    [worker],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0 && files[0].type === 'application/json') {
        handleFile(files[0])
      }
    },
    [handleFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFile(files[0])
      }
    },
    [handleFile],
  )

  return (
    <div className="w-full h-full z-[100]">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed p-8 flex flex-col items-center justify-center h-full rounded-lg transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <Upload className="h-12 w-12 text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-2">
          Click or drag file to this area to upload
        </p>
        <input
          type="file"
          accept=".json"
          onChange={handleInputChange}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer text-blue-500 hover:text-blue-600"
        >
          Click to browse
        </label>
      </div>
    </div>
  )
}
