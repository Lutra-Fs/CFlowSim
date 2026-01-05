// a service that auto saves the current model with given interval
// to IndexedDB

import { type IDBPDatabase, openDB } from 'idb'
import type { ModelSave } from '../model/modelService'
import { createLogger } from '@/utils/logger'

const logger = createLogger('autoSaveService')

export default class AutoSaveService {
  saveInterval: number
  intervalObj: ReturnType<typeof setInterval> | undefined
  maxAutoSaves: number
  getModelSerialized: () => ModelSave
  db!: IDBPDatabase
  ready = false

  constructor(
    getModelSerialized: () => ModelSave,
    saveInterval = 10000,
    maxAutoSaves = 5,
  ) {
    this.saveInterval = saveInterval
    this.maxAutoSaves = maxAutoSaves
    this.getModelSerialized = getModelSerialized
    this.intervalObj = undefined

    openDB('modelAutoSave', 1, {
      upgrade(db) {
        db.createObjectStore('modelSave', {
          keyPath: 'time',
          autoIncrement: true,
        })
      },
    })
      .then(db => {
        this.db = db
        this.ready = true
      })
      .catch(() => {
        throw new Error('Failed to open IndexedDB')
      })
  }

  startAutoSave(): void {
    if (this.intervalObj !== null && this.intervalObj !== undefined) {
      throw new Error('Auto save already started')
    }
    const autoSave = async (): Promise<void> => {
      try {
        const serialisationData = this.getModelSerialized()
        logger.debug('Auto-saving model state', { time: serialisationData.time })
        // Save the model to the database
        await this.db.add('modelSave', serialisationData)
        // Check if the total count exceeds maxAutoSaves
        const count = await this.db.count('modelSave')
        if (count > this.maxAutoSaves) {
          // Get the earliest model according to the time (index)
          const earliestModel = await this.db.getAllKeys('modelSave', null, 10)
          logger.debug('Deleting earliest auto-save', { key: earliestModel[0] })
          // Delete the earliest model
          await this.db.delete('modelSave', earliestModel[0])
        }
      } catch (error) {
        logger.error('Auto-save failed', { error: error instanceof Error ? error.message : String(error) })
      }
    }

    this.intervalObj = setInterval(() => {
      autoSave().catch(error => {
        logger.error('Auto-save interval error', { error: error instanceof Error ? error.message : String(error) })
      })
    }, this.saveInterval)
  }

  pauseAutoSave(): void {
    setTimeout(() => {
      logger.debug('Pausing auto save')
      clearInterval(this.intervalObj)
      this.intervalObj = undefined
    }, 0)
  }

  close(): void {
    this.db.close()
  }
}
