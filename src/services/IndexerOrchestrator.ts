import { EventFetcher } from './EventFetcher'
import { EventStorage } from './EventStorage'
import { logger } from '../utils/logger'

export interface IndexerOrchestratorConfig {
  chainId: number
  startBlock: number
  endBlock?: number // Optional: stop at this block instead of running continuously
  chunkSize: number
  finalityDepth: number
  pollInterval: number // milliseconds
  maxRetries?: number // Maximum retries per chunk before skipping (default: 10)
}

/**
 * Orchestrates the indexing process
 * Manages the main loop: fetch → store → update state
 * Handles errors and ensures no blocks are scanned twice
 */
export class IndexerOrchestrator {
  private config: IndexerOrchestratorConfig
  private fetcher: EventFetcher
  private storage: EventStorage
  private running = false
  private readonly maxRetries: number

  constructor(config: IndexerOrchestratorConfig, fetcher: EventFetcher, storage: EventStorage) {
    this.config = config
    this.fetcher = fetcher
    this.storage = storage
    this.maxRetries = config.maxRetries ?? 10
  }

  /**
   * Starts the continuous indexing loop
   * Polls for new blocks and processes them in chunks
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Orchestrator already running')
    }

    this.running = true

    // Get last processed block or use configured start block
    let fromBlock =
      (await this.storage.getLastProcessedBlock(this.config.chainId)) ?? this.config.startBlock

    logger.info(`Starting indexer from block ${fromBlock}`)

    while (this.running) {
      try {
        const currentBlock = await this.fetcher.provider.getBlockNumber()

        // Determine the target block: either endBlock (if specified) or current block with finality
        let targetBlock: number
        if (this.config.endBlock !== undefined) {
          // Cap endBlock at current block (can't index blocks that don't exist yet)
          const cappedEndBlock = Math.min(this.config.endBlock, currentBlock)
          // Only apply finality depth if we're near the chain tip
          // For historical blocks, use endBlock directly (no reorg risk for old blocks)
          if (cappedEndBlock >= currentBlock - this.config.finalityDepth) {
            // Near the tip - apply finality depth for reorg protection
            targetBlock = currentBlock - this.config.finalityDepth
          } else {
            // Historical sync - use endBlock directly
            targetBlock = cappedEndBlock
          }
        } else {
          // For continuous mode, apply finality depth for reorg protection
          targetBlock = currentBlock - this.config.finalityDepth
        }

        if (fromBlock > targetBlock) {
          // If endBlock is specified and we've reached it, stop
          if (this.config.endBlock !== undefined) {
            logger.info(`Reached end block ${this.config.endBlock}, stopping indexer`)
            this.running = false
            break
          }
          // Otherwise, all caught up, wait before polling again
          await this.sleep(this.config.pollInterval)
          continue
        }

        // Process in chunks
        let processedUpTo = fromBlock
        while (processedUpTo <= targetBlock) {
          const toBlock = Math.min(processedUpTo + this.config.chunkSize - 1, targetBlock)

          logger.info(`Processing blocks ${processedUpTo} to ${toBlock}`)

          let retryCount = 0
          let success = false

          while (retryCount < this.maxRetries && !success) {
            try {
              // Fetch events for chunk
              const events = await this.fetcher.fetchEvents(processedUpTo, toBlock)

              // Save to database
              await this.storage.saveEvents(events)

              // Update state
              await this.storage.updateLastProcessedBlock(this.config.chainId, toBlock)

              logger.info(`Saved ${events.length} events from blocks ${processedUpTo}-${toBlock}`)

              success = true
              processedUpTo = toBlock + 1
            } catch (error) {
              retryCount++
              logger.error(
                `Error processing blocks ${processedUpTo}-${toBlock} (attempt ${retryCount}/${this.maxRetries}):`,
                error instanceof Error ? error.message : 'Unknown error'
              )

              if (retryCount < this.maxRetries) {
                // Wait before retrying this chunk
                await this.sleep(5000)
              }
            }
          }

          // Circuit breaker: If max retries exceeded, log alert and skip chunk
          if (!success) {
            logger.error(
              `[CIRCUIT_BREAKER_ALERT] Failed to process blocks ${processedUpTo}-${toBlock} after ${this.maxRetries} attempts. Skipping chunk and continuing with next blocks. MANUAL INTERVENTION REQUIRED to backfill blocks ${processedUpTo}-${toBlock}.`
            )
            // Skip to next chunk
            processedUpTo = toBlock + 1
          }
        }

        // Update fromBlock after processing all chunks in this iteration
        fromBlock = processedUpTo
      } catch (error) {
        logger.error(
          'Error in indexer loop:',
          error instanceof Error ? error.message : 'Unknown error'
        )
        await this.sleep(5000)
      }
    }
  }

  /**
   * Stops the indexing loop
   */
  stop(): void {
    logger.info('Stopping indexer...')
    this.running = false
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
