import { IndexerOrchestrator } from '../../../src/services/IndexerOrchestrator'
import { EventFetcher } from '../../../src/services/EventFetcher'
import { EventStorage } from '../../../src/services/EventStorage'
import { connectTestDB, clearTestDB, closeTestDB } from '../../setup/db'
import { getChainConfig } from '../../../src/config'

describe('IndexerOrchestrator', () => {
  let orchestrator: IndexerOrchestrator
  let fetcher: EventFetcher
  let storage: EventStorage

  beforeAll(async () => {
    await connectTestDB()

    // Use RPC from environment config
    const polygonConfig = getChainConfig('polygon')
    fetcher = new EventFetcher({
      rpcUrl: polygonConfig.rpcUrl,
      contractAddress: polygonConfig.contractAddress,
      chainId: polygonConfig.chainId,
    })

    storage = new EventStorage()
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterEach(() => {
    if (orchestrator) {
      orchestrator.stop()
    }
  })

  describe('state management', () => {
    it('should start from configured start block when no state exists', async () => {
      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: 77000000,
          endBlock: 77000100, // Process 100 blocks of historical data
          chunkSize: 10,
          finalityDepth: 5,
          pollInterval: 1000,
        },
        fetcher,
        storage
      )

      // Start and wait for completion
      await orchestrator.start()

      // Verify state was updated to endBlock
      const lastBlock = await storage.getLastProcessedBlock(137)
      expect(lastBlock).toBe(77000100)
    }, 60000)

    it('should resume from last processed block', async () => {
      // Set initial state
      await storage.updateLastProcessedBlock(137, 77000050)

      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: 77000000, // Earlier block
          endBlock: 77000100,
          chunkSize: 10,
          finalityDepth: 5,
          pollInterval: 1000,
        },
        fetcher,
        storage
      )

      // Start and wait for completion
      await orchestrator.start()

      // Should have processed from 77000050, not 77000000
      const lastBlock = await storage.getLastProcessedBlock(137)
      expect(lastBlock).toBe(77000100)
    }, 60000)
  })

  describe('chunking', () => {
    it('should process blocks in chunks', async () => {
      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: 77000000,
          endBlock: 77000100,
          chunkSize: 10,
          finalityDepth: 5,
          pollInterval: 1000,
        },
        fetcher,
        storage
      )

      // Start and wait for completion
      await orchestrator.start()

      const lastBlock = await storage.getLastProcessedBlock(137)

      // Should have processed all blocks (100 blocks / 10 per chunk = 10 chunks)
      expect(lastBlock).toBe(77000100)
    }, 60000)
  })

  describe('finality depth', () => {
    it('should not apply finality depth for historical endBlock', async () => {
      // When endBlock is far in the past, finality depth is not applied
      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: 77000000,
          endBlock: 77000100,
          chunkSize: 10, // Must respect Alchemy's 10 block limit
          finalityDepth: 50, // Should be ignored since endBlock is historical
          pollInterval: 100,
        },
        fetcher,
        storage
      )

      // Start and wait for completion
      await orchestrator.start()

      const lastBlock = await storage.getLastProcessedBlock(137)

      // Should have processed up to endBlock (historical blocks don't need finality protection)
      expect(lastBlock).toBe(77000100)
    }, 60000)

    it('should cap endBlock at current block if set too high', async () => {
      // Test edge case: endBlock is set higher than current block
      const currentBlock = await fetcher.provider.getBlockNumber()
      const futureBlock = currentBlock + 1000000 // Way in the future

      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: currentBlock - 100,
          endBlock: futureBlock, // This should be capped at currentBlock
          chunkSize: 10,
          finalityDepth: 5,
          pollInterval: 100,
        },
        fetcher,
        storage
      )

      // Start and wait for completion
      await orchestrator.start()

      const lastBlock = await storage.getLastProcessedBlock(137)

      // Since futureBlock is capped to currentBlock, and it's near the tip,
      // finality depth should be applied: currentBlock - finalityDepth
      expect(lastBlock).toBeLessThanOrEqual(currentBlock)
      expect(lastBlock).toBeGreaterThanOrEqual(currentBlock - 10) // Within reasonable range
    }, 60000)

    it('should apply finality depth when endBlock is near chain tip', async () => {
      // When endBlock is near the current block, finality depth should be applied
      const currentBlockBefore = await fetcher.provider.getBlockNumber()
      const nearTipBlock = currentBlockBefore - 10 // Very recent

      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: nearTipBlock - 50,
          endBlock: nearTipBlock,
          chunkSize: 10,
          finalityDepth: 50, // Should be applied since endBlock is near tip
          pollInterval: 100,
        },
        fetcher,
        storage
      )

      // Start and wait for completion
      await orchestrator.start()

      const lastBlock = await storage.getLastProcessedBlock(137)
      // Fetch current block again after indexer completes (blockchain may have moved forward)
      const currentBlockAfter = await fetcher.provider.getBlockNumber()

      // Should have processed up to currentBlock - finalityDepth (not endBlock)
      // Use the maximum of the two currentBlock values to account for blockchain progression
      const maxCurrentBlock = Math.max(currentBlockBefore, currentBlockAfter)
      expect(lastBlock).toBeLessThanOrEqual(maxCurrentBlock - 50)
    }, 60000)
  })

  describe('stop mechanism', () => {
    it('should stop when requested in continuous mode', async () => {
      // Test continuous mode (no endBlock) with manual stop
      // Start from a recent block to avoid processing millions of blocks
      const currentBlock = await fetcher.provider.getBlockNumber()
      const recentBlock = currentBlock - 100

      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: recentBlock,
          // No endBlock - continuous mode
          chunkSize: 10,
          finalityDepth: 5,
          pollInterval: 1000,
        },
        fetcher,
        storage
      )

      const startPromise = orchestrator.start()

      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Stop it
      orchestrator.stop()

      // Should complete without hanging
      await expect(startPromise).resolves.toBeUndefined()
    }, 60000)

    it('should throw error when starting already running orchestrator', async () => {
      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: 77000000,
          endBlock: 77000100,
          chunkSize: 10,
          finalityDepth: 5,
          pollInterval: 1000,
        },
        fetcher,
        storage
      )

      const startPromise = orchestrator.start()

      // Try to start again immediately
      await expect(orchestrator.start()).rejects.toThrow('Orchestrator already running')

      // Wait for first start to complete
      await startPromise
    }, 60000)
  })

  describe('circuit breaker', () => {
    it('should retry failed chunks up to maxRetries times', async () => {
      // Create a mock fetcher that fails a certain number of times then succeeds
      let failCount = 0
      const maxFailures = 3
      const mockFetcher = {
        ...fetcher,
        fetchEvents: jest.fn(async (fromBlock: number, toBlock: number) => {
          if (failCount < maxFailures) {
            failCount++
            throw new Error('Simulated RPC failure')
          }
          // After maxFailures, succeed
          return fetcher.fetchEvents(fromBlock, toBlock)
        }),
      } as unknown as EventFetcher

      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: 77000000,
          endBlock: 77000009, // Single chunk of 10 blocks
          chunkSize: 10,
          finalityDepth: 5,
          pollInterval: 1000,
          maxRetries: 5, // Allow 5 retries
        },
        mockFetcher,
        storage
      )

      await orchestrator.start()

      // Should have retried and eventually succeeded
      expect(mockFetcher.fetchEvents).toHaveBeenCalledTimes(maxFailures + 1) // 3 failures + 1 success
      const lastBlock = await storage.getLastProcessedBlock(137)
      expect(lastBlock).toBe(77000009)
    }, 60000)

    it('should skip chunk after maxRetries and continue with next blocks', async () => {
      // Create a mock fetcher that always fails for first chunk, succeeds for second
      const mockFetcher = {
        ...fetcher,
        fetchEvents: jest.fn(async (fromBlock: number, toBlock: number) => {
          if (fromBlock === 77000000) {
            // First chunk always fails
            throw new Error('Persistent RPC failure')
          }
          // Second chunk succeeds
          return fetcher.fetchEvents(fromBlock, toBlock)
        }),
      } as unknown as EventFetcher

      orchestrator = new IndexerOrchestrator(
        {
          chainId: 137,
          startBlock: 77000000,
          endBlock: 77000019, // Two chunks of 10 blocks each
          chunkSize: 10,
          finalityDepth: 5,
          pollInterval: 1000,
          maxRetries: 3, // Limit retries to 3
        },
        mockFetcher,
        storage
      )

      await orchestrator.start()

      // Should have tried first chunk 3 times (maxRetries), then skipped to second chunk
      expect(mockFetcher.fetchEvents).toHaveBeenCalledWith(77000000, 77000009) // First chunk attempts
      expect(mockFetcher.fetchEvents).toHaveBeenCalledWith(77000010, 77000019) // Second chunk

      // Should have processed second chunk despite first chunk failing
      const lastBlock = await storage.getLastProcessedBlock(137)
      expect(lastBlock).toBe(77000019)
    }, 60000)
  })
})
