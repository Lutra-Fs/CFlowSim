import { expect, test, vi } from 'vitest'
import type {
  ModelSave,
  ModelService,
} from '../../src/services/model/modelService'
import {
  createModelWorkerRuntime,
  type ModelWorkerDeps,
} from '../../src/workers/modelWorker'
import type {
  WorkerCommand,
  WorkerEnvelope,
} from '../../src/workers/modelWorkerMessage'

class FakeModelService implements ModelService {
  private outputCallback: ((data: Float32Array) => void) | null = null
  private inputTensor: Float32Array
  private mass: number
  private shape: [number, number, number, number]

  constructor(
    inputTensor: Float32Array,
    mass: number,
    shape: [number, number, number, number],
  ) {
    this.inputTensor = inputTensor
    this.mass = mass
    this.shape = shape
  }

  startSimulation = vi.fn()
  pauseSimulation = vi.fn()

  bindOutput = (callback: (data: Float32Array) => void): void => {
    this.outputCallback = callback
  }

  emitOutput(data: Float32Array): void {
    this.outputCallback?.(data)
  }

  getInputTensor(): Float32Array {
    return this.inputTensor
  }

  getMass(): number {
    return this.mass
  }

  getInputShape(): [number, number, number, number] {
    return this.shape
  }

  updateForce = vi.fn()

  loadDataArray = vi.fn(
    (_array: number[][][][], _options?: { normalized?: boolean }) => {},
  )

  setMass = vi.fn((mass: number) => {
    this.mass = mass
  })

  getType(): string {
    return 'mock'
  }
}

function normalizeEnvelope(entry: WorkerEnvelope): Record<string, unknown> {
  if (entry.kind === 'event' && entry.name === 'output') {
    return {
      kind: 'event',
      name: 'output',
      frames: entry.payload.density.map(frame => Array.from(frame)),
    }
  }

  if (entry.kind === 'response' && entry.ok && entry.name === 'serialize') {
    const save = entry.payload?.save
    return {
      kind: 'response',
      name: 'serialize',
      id: entry.id,
      ok: true,
      save: save
        ? {
            modelType: save.modelType,
            modelUrl: save.modelUrl,
            mass: save.mass,
            time: save.time,
            inputTensor: save.inputTensor,
            normalized: save.normalized,
          }
        : null,
    }
  }

  if (entry.kind === 'response' && entry.ok) {
    return { kind: 'response', name: entry.name, id: entry.id, ok: true }
  }

  if (entry.kind === 'response' && !entry.ok) {
    return {
      kind: 'response',
      name: entry.name,
      id: entry.id,
      ok: false,
      error: entry.error.message,
    }
  }

  return { kind: entry.kind, name: entry.name }
}

test('worker command flow snapshot', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))

  const events: WorkerEnvelope[] = []
  const services: FakeModelService[] = []

  const createModelService = vi.fn(
    async (
      _modelPath: string,
      _gridSize?: [number, number],
      _batchSize?: number,
    ): Promise<ModelService> => {
      const service = new FakeModelService(
        new Float32Array([1, 2]),
        3,
        [1, 1, 1, 2],
      )
      services.push(service)
      return service
    },
  )

  const deps: ModelWorkerDeps = {
    createModelService,
    createAutoSaveService: () => ({
      startAutoSave: vi.fn(),
      pauseAutoSave: vi.fn(),
    }),
    fetchJson: async () => [[[[0, 1]]]],
    emit: (message: WorkerEnvelope) => {
      events.push(message)
    },
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
    },
    scheduleInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: id => clearInterval(id),
    scheduleTimeout: (fn, ms) => setTimeout(fn, ms),
  }

  const core = createModelWorkerRuntime(deps)

  const initCommand: WorkerCommand = {
    kind: 'command',
    id: 'req_init',
    name: 'init',
    payload: {
      modelPath: '/model/test.onnx',
      initConditionPath: '/initData/test.json',
    },
  }
  await core.handleCommand(initCommand)

  const startCommand: WorkerCommand = {
    kind: 'command',
    id: 'req_start',
    name: 'start',
  }
  await core.handleCommand(startCommand)

  const service = services[0]
  service.emitOutput(new Float32Array([1, 2, 3, 4, 5, 6]))
  service.emitOutput(new Float32Array([7, 8, 9, 10, 11, 12]))
  vi.advanceTimersByTime(1000)

  const serializeCommand: WorkerCommand = {
    kind: 'command',
    id: 'req_serialize',
    name: 'serialize',
  }
  await core.handleCommand(serializeCommand)

  const restoreSave: ModelSave = {
    modelType: 'mock',
    modelUrl: '/model/test.onnx',
    time: new Date().toISOString(),
    inputTensor: [[[[5, 6]]]],
    mass: 9,
  }

  const deserializeCommand: WorkerCommand = {
    kind: 'command',
    id: 'req_deserialize',
    name: 'deserialize',
    payload: { savedState: restoreSave },
  }
  await core.handleCommand(deserializeCommand)

  const snapshot = events.map(normalizeEnvelope)
  expect(snapshot).toMatchSnapshot()

  core.dispose()
  vi.useRealTimers()
})
