import { getModelForClass } from '@typegoose/typegoose'
import { FeeCollectedEvent as FeeCollectedEventModel } from '../models/FeeCollectedEvent'
import { IndexerState as IndexerStateModel } from '../models/IndexerState'
import { FeeCollectedEvent } from '../types/events'

/**
 * Handles database operations for events and indexer state
 * Manages deduplication and state persistence
 */
export class EventStorage {
  private eventModel = getModelForClass(FeeCollectedEventModel)
  private stateModel = getModelForClass(IndexerStateModel)

  /**
   * Saves events to database
   * Uses insertMany with ordered:false to skip duplicates (unique index violations)
   * Duplicates should be rare if orchestrator manages state correctly
   */
  async saveEvents(events: FeeCollectedEvent[]): Promise<void> {
    if (events.length === 0) return

    const documents = events.map(event => ({
      token: event.token,
      integrator: event.integrator,
      integratorFee: event.integratorFee.toString(),
      lifiFee: event.lifiFee.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      timestamp: event.timestamp,
      chainId: event.chainId,
    }))

    try {
      await this.eventModel.insertMany(documents, { ordered: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Ignore duplicate key errors (code 11000) - events already exist
      // This is a safety net for edge cases (crashes, manual reruns)
      if (error.code !== 11000) {
        throw error
      }
    }
  }

  /**
   * Gets last processed block for a chain
   * Returns null if no state exists (first run)
   */
  async getLastProcessedBlock(chainId: number): Promise<number | null> {
    const state = await this.stateModel.findOne({ chainId })
    return state?.lastProcessedBlock ?? null
  }

  /**
   * Updates last processed block for a chain
   * Creates new state if doesn't exist (upsert)
   */
  async updateLastProcessedBlock(chainId: number, blockNumber: number): Promise<void> {
    await this.stateModel.findOneAndUpdate(
      { chainId },
      { lastProcessedBlock: blockNumber },
      { upsert: true, new: true }
    )
  }
}
