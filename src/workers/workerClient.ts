import type { ModelSave } from '../services/model/modelService'
import type {
  CommandPayloadMap,
  CommandResponseMap,
  DeserializePayload,
  InitPayload,
  ResponseCommandName,
  SignalCommandName,
  UpdateForcePayload,
  WorkerCommand,
  WorkerEnvelope,
  WorkerEvent,
  WorkerResponse,
} from './modelWorkerMessage'

type OutputHandler = (density: Float32Array[]) => void

type PendingRequest = {
  resolve: (payload: CommandResponseMap[ResponseCommandName]) => void
  reject: (error: Error) => void
}

let requestCounter = 0

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  requestCounter += 1
  return `req_${requestCounter}`
}

export class ModelWorkerClient {
  private worker: Worker
  private pending = new Map<string, PendingRequest>()
  private outputHandlers = new Set<OutputHandler>()
  private terminated = false
  private initPromise: Promise<void> | null = null
  private initConfig: InitPayload | null = null

  constructor(worker: Worker, initConfig?: InitPayload) {
    this.worker = worker
    this.handleMessage = this.handleMessage.bind(this)
    this.worker.addEventListener('message', this.handleMessage)
    if (initConfig) {
      this.initConfig = initConfig
    }
  }

  dispose(): void {
    this.worker.removeEventListener('message', this.handleMessage)
    this.pending.forEach(pending => {
      pending.reject(new Error('Worker client disposed'))
    })
    this.pending.clear()
    this.outputHandlers.clear()
  }

  terminate(): void {
    if (this.terminated) return
    this.dispose()
    this.terminated = true
    this.worker.terminate()
  }

  onOutput(handler: OutputHandler): () => void {
    this.outputHandlers.add(handler)
    return () => {
      this.outputHandlers.delete(handler)
    }
  }

  start(): Promise<void> {
    return this.ensureInit()
      .then(() => {
        this.sendSignal('start')
      })
      .catch(error => {
        console.error('Worker init failed', error)
        throw error
      })
  }

  pause(): void {
    this.sendSignal('pause')
  }

  setActive(isActive: boolean): Promise<void> {
    if (isActive) return this.start()
    this.pause()
    return Promise.resolve()
  }

  updateForce(payload: UpdateForcePayload): void {
    this.sendSignal('update_force', payload)
  }

  async serialize(): Promise<ModelSave> {
    await this.ensureInit()
    const response = await this.sendCommand('serialize')
    return response.save
  }

  deserialize(payload: DeserializePayload): Promise<void> {
    return this.sendCommand('deserialize', payload).then(() => undefined)
  }

  private sendCommand<N extends ResponseCommandName>(
    name: N,
    payload?: CommandPayloadMap[N],
  ): Promise<CommandResponseMap[N]> {
    if (this.terminated) {
      return Promise.reject(new Error('Worker client terminated'))
    }
    const id = createRequestId()
    const command: WorkerCommand<N> = {
      kind: 'command',
      id,
      name,
      payload,
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve:
          resolve as (payload: CommandResponseMap[ResponseCommandName]) => void,
        reject,
      })
      this.worker.postMessage(command)
    })
  }

  private sendSignal<N extends SignalCommandName>(
    name: N,
    payload?: CommandPayloadMap[N],
  ): void {
    if (this.terminated) return
    const id = createRequestId()
    const command: WorkerCommand<N> = {
      kind: 'command',
      id,
      name,
      payload,
    }
    this.worker.postMessage(command)
  }

  private ensureInit(): Promise<void> {
    if (this.initPromise != null) return this.initPromise
    if (!this.initConfig) {
      return Promise.reject(new Error('init config is missing'))
    }
    this.initPromise = this.sendCommand('init', this.initConfig)
      .then(() => undefined)
      .catch(error => {
        this.initPromise = null
        throw error
      })
    return this.initPromise
  }

  private handleMessage(event: MessageEvent<WorkerEnvelope>): void {
    const message = event.data
    if (message == null || typeof message !== 'object') return
    if (message.kind === 'event') {
      this.handleEvent(message)
      return
    }
    if (message.kind === 'response') {
      this.handleResponse(message)
    }
  }

  private handleEvent(message: WorkerEvent): void {
    if (message.name !== 'output') return
    for (const handler of this.outputHandlers) {
      handler(message.payload.density)
    }
  }

  private handleResponse(message: WorkerResponse): void {
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    if (message.ok) {
      pending.resolve(message.payload as CommandResponseMap[ResponseCommandName])
      return
    }
    pending.reject(new Error(message.error.message))
  }
}
