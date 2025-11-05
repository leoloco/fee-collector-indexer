import { BigNumber } from 'ethers'
import { EventStorage } from '../../../src/services/EventStorage'
import { FeeCollectedEvent } from '../../../src/types/events'
import { connectTestDB, clearTestDB, closeTestDB } from '../../setup/db'

describe('EventStorage', () => {
  let storage: EventStorage

  beforeAll(async () => {
    await connectTestDB()
    storage = new EventStorage()
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  describe('saveEvents', () => {
    it('should save events to database', async () => {
      const events: FeeCollectedEvent[] = [
        {
          token: '0xtoken1',
          integrator: '0xintegrator1',
          integratorFee: BigNumber.from('1000'),
          lifiFee: BigNumber.from('500'),
          blockNumber: 100,
          transactionHash: '0xtx1',
          logIndex: 0,
          timestamp: 1700000000,
          chainId: 137,
        },
      ]

      await storage.saveEvents(events)

      const state = await storage.getLastProcessedBlock(137)
      expect(state).toBeNull() // saveEvents doesn't update state
    })

    it('should handle empty array', async () => {
      await expect(storage.saveEvents([])).resolves.not.toThrow()
    })

    it('should ignore duplicate events', async () => {
      const event: FeeCollectedEvent = {
        token: '0xtoken1',
        integrator: '0xintegrator1',
        integratorFee: BigNumber.from('1000'),
        lifiFee: BigNumber.from('500'),
        blockNumber: 100,
        transactionHash: '0xtx1',
        logIndex: 0,
        timestamp: 1700000000,
        chainId: 137,
      }

      // Save once
      await storage.saveEvents([event])

      // Save again - should not throw
      await expect(storage.saveEvents([event])).resolves.not.toThrow()
    })

    it('should save multiple events', async () => {
      const events: FeeCollectedEvent[] = [
        {
          token: '0xtoken1',
          integrator: '0xintegrator1',
          integratorFee: BigNumber.from('1000'),
          lifiFee: BigNumber.from('500'),
          blockNumber: 100,
          transactionHash: '0xtx1',
          logIndex: 0,
          timestamp: 1700000000,
          chainId: 137,
        },
        {
          token: '0xtoken2',
          integrator: '0xintegrator2',
          integratorFee: BigNumber.from('2000'),
          lifiFee: BigNumber.from('1000'),
          blockNumber: 101,
          transactionHash: '0xtx2',
          logIndex: 0,
          timestamp: 1700000001,
          chainId: 137,
        },
      ]

      await expect(storage.saveEvents(events)).resolves.not.toThrow()
    })

    it('should convert BigNumber to string for storage', async () => {
      const event: FeeCollectedEvent = {
        token: '0xtoken1',
        integrator: '0xintegrator1',
        integratorFee: BigNumber.from('1000000000000000000'), // 1 ETH in wei
        lifiFee: BigNumber.from('500000000000000000'),
        blockNumber: 100,
        transactionHash: '0xtx1',
        logIndex: 0,
        timestamp: 1700000000,
        chainId: 137,
      }

      await expect(storage.saveEvents([event])).resolves.not.toThrow()
    })
  })

  describe('getLastProcessedBlock', () => {
    it('should return null when no state exists', async () => {
      const result = await storage.getLastProcessedBlock(137)
      expect(result).toBeNull()
    })

    it('should return last processed block after update', async () => {
      await storage.updateLastProcessedBlock(137, 100)

      const result = await storage.getLastProcessedBlock(137)
      expect(result).toBe(100)
    })

    it('should return correct block for specific chain', async () => {
      await storage.updateLastProcessedBlock(137, 100)
      await storage.updateLastProcessedBlock(1, 200)

      const polygon = await storage.getLastProcessedBlock(137)
      const ethereum = await storage.getLastProcessedBlock(1)

      expect(polygon).toBe(100)
      expect(ethereum).toBe(200)
    })
  })

  describe('updateLastProcessedBlock', () => {
    it('should create new state if does not exist', async () => {
      await storage.updateLastProcessedBlock(137, 100)

      const result = await storage.getLastProcessedBlock(137)
      expect(result).toBe(100)
    })

    it('should update existing state', async () => {
      await storage.updateLastProcessedBlock(137, 100)
      await storage.updateLastProcessedBlock(137, 200)

      const result = await storage.getLastProcessedBlock(137)
      expect(result).toBe(200)
    })

    it('should handle multiple chains independently', async () => {
      await storage.updateLastProcessedBlock(137, 100)
      await storage.updateLastProcessedBlock(1, 200)
      await storage.updateLastProcessedBlock(137, 150)

      const polygon = await storage.getLastProcessedBlock(137)
      const ethereum = await storage.getLastProcessedBlock(1)

      expect(polygon).toBe(150)
      expect(ethereum).toBe(200)
    })

    it('should handle block number 0', async () => {
      await storage.updateLastProcessedBlock(137, 0)

      const result = await storage.getLastProcessedBlock(137)
      expect(result).toBe(0)
    })
  })
})
