import { openDB } from 'idb'
import { type JSX, useEffect, useState } from 'react'
import { Separator } from '@/components/ui/separator'
import type { ModelSave } from '../../services/model/modelService'
import type { RestoreProps } from './RestoreProps'

export default function IndexedDBRestore(props: RestoreProps): JSX.Element {
  const { workerClient } = props
  const [keys, setKeys] = useState<string[]>([])

  useEffect(() => {
    async function fetchKeys(): Promise<void> {
      const db = await openDB('modelAutoSave', 1)
      const transaction = db.transaction('modelSave', 'readonly')
      const objectStore = transaction.objectStore('modelSave')
      const allKeys = await objectStore.getAllKeys()
      setKeys(allKeys.map(key => String(key)))
    }

    void fetchKeys()
  }, [])

  function handleSelect(key: string): void {
    // Do something with the selected key
    console.log(`Selected key: ${key}`)
    // get value from indexedDB
    const request = window.indexedDB.open('modelAutoSave', 1)
    request.onerror = event => {
      console.log(event)
    }
    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const transaction = db.transaction('modelSave', 'readonly')
      const objectStore = transaction.objectStore('modelSave')
      const getRequest = objectStore.get(key)
      getRequest.onsuccess = event => {
        const value = (event.target as IDBRequest).result
        if (value !== undefined) {
          workerClient
            .deserialize({ savedState: value as ModelSave })
            .catch(error => {
              console.error('Worker deserialize failed', error)
            })
        }
      }
    }
  }

  return (
    <div className="w-full h-full z-[100]">
      <h3 className="text-xl font-semibold mb-2">Select a key to restore:</h3>
      <Separator />
      <div className="border rounded-md mt-2">
        {keys.map(key => (
          <button
            key={key}
            type="button"
            onClick={() => {
              handleSelect(key)
            }}
            className="w-full text-left p-3 border-b last:border-b-0 hover:bg-gray-100 cursor-pointer"
          >
            <span className="text-sm">{key}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
