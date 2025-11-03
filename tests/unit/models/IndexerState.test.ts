import { getModelForClass } from '@typegoose/typegoose'
import { IndexerState } from '../../../src/models/IndexerState'
import { connectTestDB, clearTestDB, closeTestDB } from '../../setup/db'

describe('IndexerState Model', () => {
  const IndexerStateModel = getModelForClass(IndexerState)

  beforeAll(async () => {
    await connectTestDB()
    await IndexerStateModel.init()
  })

  afterAll(async () => {
    await closeTestDB()
  })

  afterEach(async () => {
    await clearTestDB()
  })

  describe('Model Creation', () => {
    it('should create a valid IndexerState document', async () => {
      const stateData = {
        chainId: 137,
        lastProcessedBlock: 77000100,
      }

      const state = await IndexerStateModel.create(stateData)

      expect(state.chainId).toBe(stateData.chainId)
      expect(state.lastProcessedBlock).toBe(stateData.lastProcessedBlock)
      expect(state.updatedAt).toBeInstanceOf(Date)
    })

    it('should have timestamps (createdAt, updatedAt)', async () => {
      const stateData = {
        chainId: 137,
        lastProcessedBlock: 77000100,
      }

      const state = await IndexerStateModel.create(stateData)
      const stateDoc = state.toObject()

      expect(stateDoc).toHaveProperty('createdAt')
      expect(stateDoc).toHaveProperty('updatedAt')
      expect(stateDoc.createdAt).toBeInstanceOf(Date)
      expect(stateDoc.updatedAt).toBeInstanceOf(Date)
    })

    it('should update updatedAt timestamp on modification', async () => {
      const stateData = {
        chainId: 137,
        lastProcessedBlock: 77000100,
      }

      const state = await IndexerStateModel.create(stateData)
      const originalUpdatedAt = state.updatedAt

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10))

      // Update the state
      state.lastProcessedBlock = 77000200
      await state.save()

      expect(state.updatedAt).not.toEqual(originalUpdatedAt)
      expect(state.updatedAt!.getTime()).toBeGreaterThan(originalUpdatedAt!.getTime())
    })
  })

  describe('Validation', () => {
    it('should fail when chainId is missing', async () => {
      const invalidData = {
        lastProcessedBlock: 77000100,
      }

      await expect(IndexerStateModel.create(invalidData)).rejects.toThrow()
    })

    it('should fail when lastProcessedBlock is missing', async () => {
      const invalidData = {
        chainId: 137,
      }

      await expect(IndexerStateModel.create(invalidData)).rejects.toThrow()
    })
  })

  describe('Uniqueness Constraints', () => {
    it('should enforce unique chainId constraint', async () => {
      const stateData = {
        chainId: 137,
        lastProcessedBlock: 77000100,
      }

      // Create first state
      await IndexerStateModel.create(stateData)

      // Try to create duplicate with same chainId - should fail
      await expect(
        IndexerStateModel.create({
          chainId: 137,
          lastProcessedBlock: 77000200,
        })
      ).rejects.toThrow()
    })

    it('should allow different chainIds', async () => {
      await IndexerStateModel.create({
        chainId: 137, // Polygon
        lastProcessedBlock: 77000100,
      })

      const state2 = await IndexerStateModel.create({
        chainId: 1, // Ethereum
        lastProcessedBlock: 12345678,
      })

      expect(state2.chainId).toBe(1)
      expect(state2.lastProcessedBlock).toBe(12345678)
    })
  })

  describe('State Updates', () => {
    it('should update lastProcessedBlock for existing state', async () => {
      const stateData = {
        chainId: 137,
        lastProcessedBlock: 77000100,
      }

      const state = await IndexerStateModel.create(stateData)
      expect(state.lastProcessedBlock).toBe(77000100)

      // Update the block number
      state.lastProcessedBlock = 77000200
      await state.save()

      // Fetch from DB to verify
      const updatedState = await IndexerStateModel.findOne({ chainId: 137 })
      expect(updatedState!.lastProcessedBlock).toBe(77000200)
    })

    it('should support findOneAndUpdate for atomic updates', async () => {
      await IndexerStateModel.create({
        chainId: 137,
        lastProcessedBlock: 77000100,
      })

      const updatedState = await IndexerStateModel.findOneAndUpdate(
        { chainId: 137 },
        { lastProcessedBlock: 77000300 },
        { new: true } // Return updated document
      )

      expect(updatedState!.lastProcessedBlock).toBe(77000300)
    })

    it('should support upsert (create or update) pattern', async () => {
      // First upsert - should create
      const state1 = await IndexerStateModel.findOneAndUpdate(
        { chainId: 137 },
        { lastProcessedBlock: 77000100 },
        { new: true, upsert: true }
      )

      expect(state1.chainId).toBe(137)
      expect(state1.lastProcessedBlock).toBe(77000100)

      // Second upsert - should update
      const state2 = await IndexerStateModel.findOneAndUpdate(
        { chainId: 137 },
        { lastProcessedBlock: 77000200 },
        { new: true, upsert: true }
      )

      expect(state2.chainId).toBe(137)
      expect(state2.lastProcessedBlock).toBe(77000200)

      // Verify only one document exists
      const count = await IndexerStateModel.countDocuments({ chainId: 137 })
      expect(count).toBe(1)
    })
  })

  describe('Querying', () => {
    beforeEach(async () => {
      // Create states for multiple chains
      await IndexerStateModel.create([
        { chainId: 137, lastProcessedBlock: 77000100 },
        { chainId: 1, lastProcessedBlock: 12345678 },
        { chainId: 42161, lastProcessedBlock: 98765432 },
      ])
    })

    it('should retrieve state by chainId', async () => {
      const state = await IndexerStateModel.findOne({ chainId: 137 })

      expect(state).not.toBeNull()
      expect(state!.chainId).toBe(137)
      expect(state!.lastProcessedBlock).toBe(77000100)
    })

    it('should retrieve all states', async () => {
      const states = await IndexerStateModel.find()

      expect(states).toHaveLength(3)
      expect(states.map(s => s.chainId).sort()).toEqual([1, 137, 42161])
    })

    it('should return null for non-existent chainId', async () => {
      const state = await IndexerStateModel.findOne({ chainId: 999 })
      expect(state).toBeNull()
    })
  })

  describe('Starting Block Logic', () => {
    it('should handle getting or initializing state', async () => {
      const chainId = 137
      const startingBlock = 77000000

      // Try to get existing state or create new one
      let state = await IndexerStateModel.findOne({ chainId })

      if (!state) {
        state = await IndexerStateModel.create({
          chainId,
          lastProcessedBlock: startingBlock,
        })
      }

      expect(state.chainId).toBe(chainId)
      expect(state.lastProcessedBlock).toBe(startingBlock)

      // Second call should retrieve existing state
      const state2 = await IndexerStateModel.findOne({ chainId })
      expect(state2!.lastProcessedBlock).toBe(startingBlock)
    })
  })
})
