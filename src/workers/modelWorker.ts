import Ajv, { type JSONSchemaType } from 'ajv'
import AutoSaveService from '../services/autoSave/autoSaveService'
import {
  createModelService,
  modelSerialize,
  type ModelSave,
  type ModelService,
} from '../services/model/modelService'
import { createLogger } from '../utils/logger'
import type { Vector2 } from 'three'
import {
  type DeserializePayload,
  type InitPayload,
  type UpdateForcePayload,
  type WorkerCommand,
  type WorkerEnvelope,
  isWorkerCommand,
} from './modelWorkerMessage'

const logger = createLogger('modelWorker')

export interface AutoSaveController {
  startAutoSave: () => void
  pauseAutoSave: () => void
}

export interface WorkerLogger {
  debug: (message: string, meta?: Record<string, unknown>) => void
  error: (message: string, meta?: Record<string, unknown>) => void
}

export interface ModelWorkerDeps {
  createModelService: (
    modelPath: string,
    gridSize?: [number, number],
    batchSize?: number,
  ) => Promise<ModelService>
  createAutoSaveService: (
    getModelSerialized: () => ModelSave,
  ) => AutoSaveController
  fetchJson: (path: string) => Promise<number[][][][]>
  emit: (message: WorkerEnvelope, transfer?: Transferable[]) => void
  logger: WorkerLogger
  scheduleInterval: (fn: () => void, ms: number) => ReturnType<typeof setInterval>
  clearInterval: (id: ReturnType<typeof setInterval>) => void
  scheduleTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
}

export interface ModelWorkerRuntime {
  handleCommand: (command: WorkerCommand) => Promise<void>
  dispose: () => void
}

const modelSaveSchema: JSONSchemaType<ModelSave> = {
  type: 'object',
  properties: {
    modelType: { type: 'string' },
    modelUrl: { type: 'string' },
    time: { type: 'string' },
    inputTensor: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'number' },
          },
        },
      },
    },
    mass: { type: 'number' },
  },
  required: ['modelType', 'modelUrl', 'inputTensor', 'mass'],
  additionalProperties: false,
}

const ajv = new Ajv()
const modelSaveSchemaValidator = ajv.compile(modelSaveSchema)

export function createModelWorkerRuntime(
  deps: ModelWorkerDeps,
): ModelWorkerRuntime {
  let modelService: ModelService | null = null
  let autoSaveService: AutoSaveController | null = null
  let modelUrl = ''
  let isRunning = false
  let outputIntervalId: ReturnType<typeof setInterval> | null = null
  let outputCache: Float32Array[] = []
  let outputIndex = 0

  const emitResponseOk = (
    name: 'init' | 'serialize' | 'deserialize',
    id: string,
    payload?: { save: ModelSave },
  ): void => {
    deps.emit({
      kind: 'response',
      id,
      name,
      ok: true,
      payload,
    })
  }

  const emitResponseError = (
    name: 'init' | 'serialize' | 'deserialize',
    id: string,
    message: string,
  ): void => {
    deps.emit({
      kind: 'response',
      id,
      name,
      ok: false,
      error: { message },
    })
  }

  const serializeCurrent = (): ModelSave => {
    if (modelService == null)
      throw new Error('modelService is null, cannot serialize')
    const save = modelSerialize(modelUrl, modelService)
    if (save == null)
      throw new Error('modelSerialize returned null result')
    return save
  }

  const bindOutput = (service: ModelService): void => {
    const outputStride = 2
    outputCache = []
    outputIndex = 0
    if (outputIntervalId != null) {
      deps.clearInterval(outputIntervalId)
      outputIntervalId = null
    }

    const outputCallback = (output: Float32Array): void => {
      if (!isRunning) return
      outputIndex++
      if (outputIndex % outputStride !== 0) return
      const density = new Float32Array(output.length / 3)
      for (let i = 0; i < density.length; i++) {
        density[i] = output[i * 3]
      }
      outputCache.push(density)
    }

    outputIntervalId = deps.scheduleInterval(() => {
      if (!isRunning) return
      if (outputCache.length === 0) return
      const frames = outputCache.splice(0, outputCache.length)
      const transfer = frames.map(frame => frame.buffer)
      deps.emit(
        {
          kind: 'event',
          name: 'output',
          payload: { density: frames },
        },
        transfer,
      )
    }, 1000)

    service.bindOutput(outputCallback)
  }

  const getServiceFromSave = async (save: ModelSave): Promise<ModelService> => {
    deps.logger.debug('Restoring model service from save')
    const service = await deps.createModelService(save.modelUrl, [64, 64], 1)
    modelUrl = save.modelUrl
    bindOutput(service)
    service.loadDataArray(save.inputTensor)
    service.setMass(save.mass)
    return service
  }

  const getServiceFromInitCond = async (
    initConditionPath: string,
    modelPath: string,
  ): Promise<ModelService> => {
    const service = await deps.createModelService(modelPath, [64, 64], 1)
    bindOutput(service)
    if (
      !initConditionPath.startsWith('/initData/') ||
      !initConditionPath.endsWith('.json')
    ) {
      throw new Error(`invalid data path ${initConditionPath}`)
    }
    const data = await deps.fetchJson(initConditionPath)
    service.loadDataArray(data as number[][][][])
    return service
  }

  const handleInit = async (
    id: string,
    payload?: InitPayload,
  ): Promise<void> => {
    if (modelService != null) {
      emitResponseError('init', id, 'modelService already initialized')
      return
    }
    if (!payload) {
      emitResponseError('init', id, 'init payload missing')
      return
    }
    try {
      modelUrl = payload.modelPath
      const service = await getServiceFromInitCond(
        payload.initConditionPath,
        payload.modelPath,
      )
      modelService = service
      autoSaveService = deps.createAutoSaveService(serializeCurrent)
      emitResponseOk('init', id)
    } catch (error) {
      deps.logger.error('Service initialization failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      emitResponseError(
        'init',
        id,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  const handleStart = (): void => {
    if (modelService == null) {
      deps.logger.debug('start ignored, modelService is null')
      return
    }
    if (isRunning) return
    isRunning = true
    modelService.startSimulation()
    if (autoSaveService != null) {
      try {
        autoSaveService.startAutoSave()
      } catch (error) {
        const err = error as Error
        if (err.message === 'IndexedDB not ready') {
          deps.scheduleTimeout(() => {
            autoSaveService?.startAutoSave()
          }, 500)
        } else {
          deps.logger.error('autoSave start failed', {
            error: err.message,
          })
        }
      }
    }
  }

  const handlePause = (): void => {
    if (modelService == null) return
    if (!isRunning) return
    isRunning = false
    modelService.pauseSimulation()
    if (autoSaveService != null) {
      autoSaveService.pauseAutoSave()
    }
  }

  const handleUpdateForce = (payload?: UpdateForcePayload): void => {
    if (modelService == null) return
    if (!payload) {
      deps.logger.error('update_force payload missing')
      return
    }
    modelService.updateForce(
      payload.loc as unknown as Vector2,
      payload.forceDelta as unknown as Vector2,
    )
  }

  const handleSerialize = (id: string): void => {
    if (modelService == null) {
      emitResponseError('serialize', id, 'modelService is null')
      return
    }
    try {
      const save = serializeCurrent()
      emitResponseOk('serialize', id, { save })
    } catch (error) {
      emitResponseError(
        'serialize',
        id,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  const handleDeserialize = async (
    id: string,
    payload?: DeserializePayload,
  ): Promise<void> => {
    if (!payload) {
      emitResponseError('deserialize', id, 'deserialize payload missing')
      return
    }
    try {
      const { savedState } = payload
      let possibleSave: ModelSave
      if (typeof savedState === 'string') {
        possibleSave = JSON.parse(savedState) as ModelSave
        if (!modelSaveSchemaValidator(possibleSave)) {
          emitResponseError('deserialize', id, 'invalid modelSave')
          return
        }
      } else {
        possibleSave = savedState
      }
      const service = await getServiceFromSave(possibleSave)
      modelService = service
      emitResponseOk('deserialize', id)
    } catch (error) {
      emitResponseError(
        'deserialize',
        id,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  const handleCommand = async (command: WorkerCommand): Promise<void> => {
    deps.logger.debug('Worker received command', {
      name: command.name,
    })
    switch (command.name) {
      case 'init':
        await handleInit(command.id, command.payload as InitPayload)
        return
      case 'start':
        handleStart()
        return
      case 'pause':
        handlePause()
        return
      case 'update_force':
        handleUpdateForce(command.payload as UpdateForcePayload)
        return
      case 'serialize':
        handleSerialize(command.id)
        return
      case 'deserialize':
        await handleDeserialize(command.id, command.payload as DeserializePayload)
        return
    }
  }

  const dispose = (): void => {
    if (outputIntervalId != null) {
      deps.clearInterval(outputIntervalId)
      outputIntervalId = null
    }
    outputCache = []
  }

  return { handleCommand, dispose }
}

const workerRuntime =
  typeof self === 'undefined'
    ? null
    : createModelWorkerRuntime({
        createModelService,
        createAutoSaveService: getModelSerialized =>
          new AutoSaveService(getModelSerialized),
        fetchJson: async (dataPath: string) => {
          const response = await fetch(dataPath)
          if (!response.ok) {
            throw new Error(`failed to fetch data from ${dataPath}`)
          }
          const contentType = response.headers.get('content-type')
          if (contentType != null && !contentType.startsWith('application/json')) {
            throw new Error(`invalid content type ${contentType}`)
          }
          return (await response.json()) as number[][][][]
        },
        emit: (message, transfer) => {
          if (transfer != null && transfer.length > 0) {
            self.postMessage(message, transfer)
            return
          }
          self.postMessage(message)
        },
        logger,
        scheduleInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: id => clearInterval(id),
        scheduleTimeout: (fn, ms) => setTimeout(fn, ms),
      })

if (workerRuntime && typeof self !== 'undefined') {
  self.onmessage = event => {
    const data = event.data
    if (!isWorkerCommand(data)) {
      logger.error('Worker received invalid command', {
        dataType: typeof data,
      })
      return
    }
    void workerRuntime.handleCommand(data)
  }
}
