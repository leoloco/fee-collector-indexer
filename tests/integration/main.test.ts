import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { connectDB, disconnectDB } from '../../src/db'
import { getConfig, getChainConfig } from '../../src/config'
import { EventStorage } from '../../src/services/EventStorage'
import { EventFetcher } from '../../src/services/EventFetcher'
import { IndexerOrchestrator } from '../../src/services/IndexerOrchestrator'

describe('Main Application Integration Tests', () => {
  let mongoServer: MongoMemoryServer
  const originalEnv = process.env

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()

    // Set up test environment with Polygon chain
    process.env = {
      ...originalEnv,
      MONGODB_URI: mongoUri,
      ENABLED_CHAINS: 'polygon',
      POLYGON_RPC: originalEnv.POLYGON_RPC || 'https://polygon-rpc.com',
      PORT: '3000',
      API_ENABLED: 'false',
      LOG_LEVEL: 'error', // Suppress logs during tests
    }
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
    process.env = originalEnv
  })

  afterEach(async () => {
    // Disconnect after each test to reset connection state
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
  })

  it('should connect to MongoDB successfully', async () => {
    await connectDB()

    expect(mongoose.connection.readyState).toBe(1) // 1 = connected
  })

  it('should disconnect from MongoDB successfully', async () => {
    await connectDB()
    expect(mongoose.connection.readyState).toBe(1)

    await disconnectDB()
    expect(mongoose.connection.readyState).toBe(0) // 0 = disconnected
  })

  it('should load configuration correctly', async () => {
    const config = getConfig()
    expect(config.mongodbUri).toBeDefined()
    expect(config.enabledChains).toContain('polygon')

    const chainConfig = getChainConfig('polygon')
    expect(chainConfig.chainId).toBe(137)
    expect(chainConfig.contractAddress).toBe('0xbd6c7b0d2f68c2b7805d88388319cfb6ecb50ea9')
    expect(chainConfig.startBlock).toBe(77000000)
  })

  it('should create EventStorage instance', async () => {
    await connectDB()

    const storage = new EventStorage()

    expect(storage).toBeDefined()
    expect(typeof storage.saveEvents).toBe('function')
    expect(typeof storage.getLastProcessedBlock).toBe('function')
  })

  it('should create EventFetcher instance with config', async () => {
    const chainConfig = getChainConfig('polygon')
    const fetcher = new EventFetcher({
      rpcUrl: chainConfig.rpcUrl,
      contractAddress: chainConfig.contractAddress,
      chainId: chainConfig.chainId,
    })

    expect(fetcher).toBeDefined()
    expect(typeof fetcher.fetchEvents).toBe('function')
    expect(fetcher.provider).toBeDefined()
    expect(typeof fetcher.provider.getBlockNumber).toBe('function')
  })

  it('should create IndexerOrchestrator instance', async () => {
    await connectDB()

    const chainConfig = getChainConfig('polygon')
    const fetcher = new EventFetcher({
      rpcUrl: chainConfig.rpcUrl,
      contractAddress: chainConfig.contractAddress,
      chainId: chainConfig.chainId,
    })
    const storage = new EventStorage()

    const orchestrator = new IndexerOrchestrator(
      {
        chainId: chainConfig.chainId,
        startBlock: chainConfig.startBlock,
        endBlock: chainConfig.startBlock + 9, // Small range for test
        chunkSize: chainConfig.chunkSize,
        finalityDepth: 0,
        pollInterval: 1000,
      },
      fetcher,
      storage
    )

    expect(orchestrator).toBeDefined()
    expect(typeof orchestrator.start).toBe('function')
    expect(typeof orchestrator.stop).toBe('function')
  })

  it('should initialize all components for multi-chain setup', async () => {
    await connectDB()

    const config = getConfig()
    const storage = new EventStorage()
    const orchestrators: IndexerOrchestrator[] = []

    // Create orchestrator for each enabled chain
    for (const chainName of config.enabledChains) {
      const chainConfig = getChainConfig(chainName)

      const fetcher = new EventFetcher({
        rpcUrl: chainConfig.rpcUrl,
        contractAddress: chainConfig.contractAddress,
        chainId: chainConfig.chainId,
      })

      const orchestrator = new IndexerOrchestrator(
        {
          chainId: chainConfig.chainId,
          startBlock: chainConfig.startBlock,
          endBlock: chainConfig.startBlock + 9,
          chunkSize: chainConfig.chunkSize,
          finalityDepth: 0,
          pollInterval: 1000,
        },
        fetcher,
        storage
      )

      orchestrators.push(orchestrator)
    }

    // Verify we created orchestrators for all chains
    expect(orchestrators.length).toBe(config.enabledChains.length)
    expect(orchestrators.length).toBeGreaterThan(0)
  })
})
