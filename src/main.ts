import { connectDB, disconnectDB } from './db'
import { getConfig, getChainConfig } from './config'
import { EventFetcher } from './services/EventFetcher'
import { EventStorage } from './services/EventStorage'
import { IndexerOrchestrator } from './services/IndexerOrchestrator'
import { startServer } from './api/server'
import { logger } from './utils/logger'

/**
 * Main entry point for the fee collector indexer
 * Supports indexing multiple EVM chains simultaneously
 */
async function main() {
  try {
    logger.info('Starting Fee Collector Indexer...')

    // Load configuration
    const config = getConfig()
    logger.info(`Enabled chains: ${config.enabledChains.join(', ')}`)

    // Connect to MongoDB
    await connectDB()

    // Start API server if enabled
    if (config.api.enabled) {
      startServer(config.api.port)
    } else {
      logger.info('API server is disabled')
    }

    // Create storage instance (shared across all chains)
    const storage = new EventStorage()

    // Create orchestrators for each enabled chain
    const orchestrators: IndexerOrchestrator[] = []

    for (const chainName of config.enabledChains) {
      const chainConfig = getChainConfig(chainName)

      logger.info(
        `Initializing indexer for ${chainName} (chainId: ${chainConfig.chainId}, startBlock: ${chainConfig.startBlock})`
      )

      // Create event fetcher for this chain
      const fetcher = new EventFetcher({
        rpcUrl: chainConfig.rpcUrl,
        contractAddress: chainConfig.contractAddress,
        chainId: chainConfig.chainId,
      })

      // Create orchestrator for this chain (continuous mode - no endBlock)
      const orchestrator = new IndexerOrchestrator(
        {
          chainId: chainConfig.chainId,
          startBlock: chainConfig.startBlock,
          // No endBlock - run in continuous mode
          chunkSize: chainConfig.chunkSize,
          finalityDepth: chainConfig.finalityDepth,
          pollInterval: 10000, // 10 seconds between polls
        },
        fetcher,
        storage
      )

      orchestrators.push(orchestrator)
    }

    // Start all orchestrators in parallel
    logger.info(`Starting ${orchestrators.length} indexer(s)...`)

    const orchestratorPromises = orchestrators.map(orchestrator => orchestrator.start())

    // Wait for all orchestrators to complete (they won't in continuous mode unless stopped)
    await Promise.all(orchestratorPromises)

    logger.info('All indexers completed')
  } catch (error) {
    logger.error('Fatal error in main:', error instanceof Error ? error.message : 'Unknown error')
    if (error instanceof Error && error.stack) {
      logger.error(error.stack)
    }
    process.exit(1)
  }
}

// Handle graceful shutdown
let isShuttingDown = false

async function shutdown(signal: string) {
  if (isShuttingDown) {
    return
  }
  isShuttingDown = true

  logger.info(`Received ${signal}, shutting down gracefully...`)

  try {
    // Disconnect from MongoDB
    await disconnectDB()
    logger.info('Shutdown complete')
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Run main function
main()
