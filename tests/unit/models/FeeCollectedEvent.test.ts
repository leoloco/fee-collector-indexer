import { getModelForClass } from '@typegoose/typegoose'
import { FeeCollectedEvent } from '../../../src/models/FeeCollectedEvent'
import { connectTestDB, clearTestDB, closeTestDB } from '../../setup/db'

describe('FeeCollectedEvent Model', () => {
  const FeeCollectedEventModel = getModelForClass(FeeCollectedEvent)

  beforeAll(async () => {
    await connectTestDB()
    await FeeCollectedEventModel.init()
  })

  afterAll(async () => {
    await closeTestDB()
  })

  afterEach(async () => {
    await clearTestDB()
  })

  describe('Model Creation', () => {
    it('should create a valid FeeCollectedEvent document', async () => {
      const eventData = {
        token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        integrator: '0x1234567890123456789012345678901234567890',
        integratorFee: '1000000000000000000',
        lifiFee: '500000000000000000',
        blockNumber: 77000001,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        logIndex: 0,
        timestamp: 1234567890,
        chainId: 137,
      }

      const event = await FeeCollectedEventModel.create(eventData)

      expect(event.token).toBe(eventData.token)
      expect(event.integrator).toBe(eventData.integrator)
      expect(event.integratorFee).toBe(eventData.integratorFee)
      expect(event.lifiFee).toBe(eventData.lifiFee)
      expect(event.blockNumber).toBe(eventData.blockNumber)
      expect(event.transactionHash).toBe(eventData.transactionHash)
      expect(event.logIndex).toBe(eventData.logIndex)
      expect(event.timestamp).toBe(eventData.timestamp)
      expect(event.chainId).toBe(eventData.chainId)
    })

    it('should convert addresses to lowercase', async () => {
      const eventData = {
        token: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        integrator: '0x1234567890ABCDEF1234567890ABCDEF12345678',
        integratorFee: '1000000000000000000',
        lifiFee: '500000000000000000',
        blockNumber: 77000001,
        transactionHash: '0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        logIndex: 0,
        timestamp: 1234567890,
        chainId: 137,
      }

      const event = await FeeCollectedEventModel.create(eventData)

      expect(event.token).toBe(eventData.token.toLowerCase())
      expect(event.integrator).toBe(eventData.integrator.toLowerCase())
      expect(event.transactionHash).toBe(eventData.transactionHash.toLowerCase())
    })

    it('should have timestamps (createdAt, updatedAt)', async () => {
      const eventData = {
        token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        integrator: '0x1234567890123456789012345678901234567890',
        integratorFee: '1000000000000000000',
        lifiFee: '500000000000000000',
        blockNumber: 77000001,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        logIndex: 0,
        timestamp: 1234567890,
        chainId: 137,
      }

      const event = await FeeCollectedEventModel.create(eventData)
      const eventDoc = event.toObject()

      expect(eventDoc).toHaveProperty('createdAt')
      expect(eventDoc).toHaveProperty('updatedAt')
      expect(eventDoc.createdAt).toBeInstanceOf(Date)
      expect(eventDoc.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('Validation', () => {
    it('should fail when required fields are missing', async () => {
      const invalidData = {
        token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        // Missing other required fields
      }

      await expect(FeeCollectedEventModel.create(invalidData)).rejects.toThrow()
    })

    it('should fail when token is missing', async () => {
      const eventData = {
        integrator: '0x1234567890123456789012345678901234567890',
        integratorFee: '1000000000000000000',
        lifiFee: '500000000000000000',
        blockNumber: 77000001,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        logIndex: 0,
        timestamp: 1234567890,
        chainId: 137,
      }

      await expect(FeeCollectedEventModel.create(eventData)).rejects.toThrow()
    })
  })

  describe('Uniqueness Constraints', () => {
    it('should prevent duplicate events with same chainId, blockNumber, txHash, and logIndex', async () => {
      const eventData = {
        token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        integrator: '0x1234567890123456789012345678901234567890',
        integratorFee: '1000000000000000000',
        lifiFee: '500000000000000000',
        blockNumber: 77000001,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        logIndex: 0,
        timestamp: 1234567890,
        chainId: 137,
      }

      // Create first event
      await FeeCollectedEventModel.create(eventData)

      // Try to create duplicate - should fail
      await expect(FeeCollectedEventModel.create(eventData)).rejects.toThrow()
    })

    it('should allow events with same txHash but different logIndex', async () => {
      const baseEventData = {
        token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        integrator: '0x1234567890123456789012345678901234567890',
        integratorFee: '1000000000000000000',
        lifiFee: '500000000000000000',
        blockNumber: 77000001,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        timestamp: 1234567890,
        chainId: 137,
      }

      // Create first event with logIndex 0
      await FeeCollectedEventModel.create({ ...baseEventData, logIndex: 0 })

      // Create second event with logIndex 1 - should succeed
      const event2 = await FeeCollectedEventModel.create({ ...baseEventData, logIndex: 1 })
      expect(event2.logIndex).toBe(1)
    })

    it('should allow events with same blockNumber but different txHash', async () => {
      const baseEventData = {
        token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        integrator: '0x1234567890123456789012345678901234567890',
        integratorFee: '1000000000000000000',
        lifiFee: '500000000000000000',
        blockNumber: 77000001,
        logIndex: 0,
        timestamp: 1234567890,
        chainId: 137,
      }

      // Create first event
      await FeeCollectedEventModel.create({
        ...baseEventData,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      })

      // Create second event with different txHash - should succeed
      const event2 = await FeeCollectedEventModel.create({
        ...baseEventData,
        transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      })
      expect(event2.transactionHash).toBe(
        '0x1111111111111111111111111111111111111111111111111111111111111111'
      )
    })
  })

  describe('Querying', () => {
    beforeEach(async () => {
      // Create sample events
      await FeeCollectedEventModel.create([
        {
          token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          integrator: '0x1234567890123456789012345678901234567890',
          integratorFee: '1000000000000000000',
          lifiFee: '500000000000000000',
          blockNumber: 77000001,
          transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          logIndex: 0,
          timestamp: 1234567890,
          chainId: 137,
        },
        {
          token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          integrator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          integratorFee: '2000000000000000000',
          lifiFee: '1000000000000000000',
          blockNumber: 77000002,
          transactionHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          logIndex: 0,
          timestamp: 1234567900,
          chainId: 137,
        },
        {
          token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          integrator: '0x1234567890123456789012345678901234567890',
          integratorFee: '3000000000000000000',
          lifiFee: '1500000000000000000',
          blockNumber: 77000003,
          transactionHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          logIndex: 0,
          timestamp: 1234567910,
          chainId: 137,
        },
      ])
    })

    it('should query events by integrator', async () => {
      const events = await FeeCollectedEventModel.find({
        integrator: '0x1234567890123456789012345678901234567890',
      })

      expect(events).toHaveLength(2)
      events.forEach(event => {
        expect(event.integrator).toBe('0x1234567890123456789012345678901234567890')
      })
    })

    it('should query events by chainId', async () => {
      const events = await FeeCollectedEventModel.find({ chainId: 137 })
      expect(events).toHaveLength(3)
    })

    it('should query events by block range', async () => {
      const events = await FeeCollectedEventModel.find({
        blockNumber: { $gte: 77000002, $lte: 77000003 },
      })

      expect(events).toHaveLength(2)
      expect(events[0].blockNumber).toBeGreaterThanOrEqual(77000002)
      expect(events[1].blockNumber).toBeLessThanOrEqual(77000003)
    })

    it('should query events by integrator and chainId', async () => {
      const events = await FeeCollectedEventModel.find({
        integrator: '0x1234567890123456789012345678901234567890',
        chainId: 137,
      })

      expect(events).toHaveLength(2)
    })
  })

  describe('BigNumber Storage', () => {
    it('should store large BigNumber values as strings without precision loss', async () => {
      const largeValue = '123456789012345678901234567890'
      const eventData = {
        token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        integrator: '0x1234567890123456789012345678901234567890',
        integratorFee: largeValue,
        lifiFee: largeValue,
        blockNumber: 77000001,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        logIndex: 0,
        timestamp: 1234567890,
        chainId: 137,
      }

      const event = await FeeCollectedEventModel.create(eventData)

      expect(event.integratorFee).toBe(largeValue)
      expect(event.lifiFee).toBe(largeValue)
    })
  })
})
