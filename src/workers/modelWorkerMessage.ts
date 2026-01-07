import type { ModelSave } from '../services/model/modelService'

export type WorkerCommandName =
  | 'init'
  | 'start'
  | 'pause'
  | 'deserialize'
  | 'update_force'
  | 'serialize'
  | 'reinit'

export type ResponseCommandName = 'init' | 'serialize' | 'deserialize' | 'reinit'

export type SignalCommandName = Exclude<WorkerCommandName, ResponseCommandName>

export interface Vector2Payload {
  x: number
  y: number
}

export interface InitPayload {
  modelPath: string
  initConditionPath: string
}

export interface DeserializePayload {
  savedState: string | ModelSave
}

export interface ReinitPayload {
  initConditionPath: string
}

export interface UpdateForcePayload {
  loc: Vector2Payload
  forceDelta: Vector2Payload
}

export interface CommandPayloadMap {
  init: InitPayload
  start: undefined
  pause: undefined
  deserialize: DeserializePayload
  update_force: UpdateForcePayload
  serialize: undefined
  reinit: ReinitPayload
}

export interface CommandResponseMap {
  init: undefined
  deserialize: undefined
  serialize: { save: ModelSave }
  reinit: undefined
}

export interface WorkerError {
  message: string
  code?: string
}

export interface WorkerCommand<
  N extends WorkerCommandName = WorkerCommandName,
> {
  kind: 'command'
  id: string
  name: N
  payload?: CommandPayloadMap[N]
}

export type WorkerResponse<
  N extends ResponseCommandName = ResponseCommandName,
> =
  | {
      kind: 'response'
      id: string
      name: N
      ok: true
      payload?: CommandResponseMap[N]
    }
  | {
      kind: 'response'
      id: string
      name: N
      ok: false
      error: WorkerError
    }

export interface WorkerEvent {
  kind: 'event'
  name: 'output'
  payload: { density: Float32Array[] }
}

export type WorkerEnvelope = WorkerCommand | WorkerResponse | WorkerEvent

const commandNames = new Set<WorkerCommandName>([
  'init',
  'start',
  'pause',
  'deserialize',
  'update_force',
  'serialize',
  'reinit',
])

export function isWorkerCommand(value: unknown): value is WorkerCommand {
  if (value == null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.kind !== 'command') return false
  if (typeof record.id !== 'string') return false
  if (typeof record.name !== 'string') return false
  return commandNames.has(record.name as WorkerCommandName)
}
