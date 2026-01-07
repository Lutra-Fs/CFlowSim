import type { ModelWorkerClient } from '../../workers/workerClient'

export interface RestoreProps {
  workerClient: ModelWorkerClient
  setRestorePopupVisible: React.Dispatch<React.SetStateAction<boolean>>
}
