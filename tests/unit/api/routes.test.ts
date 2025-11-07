import request from 'supertest'
import { getModelForClass } from '@typegoose/typegoose'
import { FeeCollectedEvent } from '../../../src/models/FeeCollectedEvent'
import { createApp } from '../../../src/api/server'
import { connectTestDB, clearTestDB, closeTestDB } from '../../setup/db'

describe('API Routes', () => {
  const FeeCollectedEventModel = getModelForClass(FeeCollectedEvent)
  const app = createApp()

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

  describe('GET /health', () => {
    it('should return 200 OK with status', async () => {
      const response = await request(app).get('/health').expect(200).expect('Content-Type', /json/)

      expect(response.body).toEqual({ status: 'ok' })
    })
  })

  describe('GET /api/events', () => {
    const integrator1 = '0x1234567890123456789012345678901234567890'
    const integrator2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

    beforeEach(async () => {
      // Create test data
      await FeeCollectedEventModel.create([
        {
          token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          integrator: integrator1,
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
          integrator: integrator1,
          integratorFee: '2000000000000000000',
          lifiFee: '600000000000000000',
          blockNumber: 77000002,
          transactionHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          logIndex: 0,
          timestamp: 1234567891,
          chainId: 137,
        },
        {
          token: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          integrator: integrator2,
          integratorFee: '3000000000000000000',
          lifiFee: '700000000000000000',
          blockNumber: 77000003,
          transactionHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          logIndex: 0,
          timestamp: 1234567892,
          chainId: 137,
        },
      ])
    })

    it('should return events for a given integrator', async () => {
      const response = await request(app)
        .get(`/api/events?integrator=${integrator1}`)
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toHaveLength(2)
      expect(response.body[0].integrator).toBe(integrator1)
      expect(response.body[1].integrator).toBe(integrator1)
    })

    it('should handle mixed-case integrator addresses', async () => {
      // Only uppercase the hex part, not the 0x prefix (which must be lowercase)
      const mixedCaseIntegrator = '0x' + integrator1.slice(2).toUpperCase()
      const response = await request(app)
        .get(`/api/events?integrator=${mixedCaseIntegrator}`)
        .expect(200)

      expect(response.body).toHaveLength(2)
    })

    it('should return events in chronological order', async () => {
      const response = await request(app).get(`/api/events?integrator=${integrator1}`).expect(200)

      expect(response.body[0].blockNumber).toBe(77000001)
      expect(response.body[1].blockNumber).toBe(77000002)
    })

    it('should return empty array for integrator with no events', async () => {
      const nonExistentIntegrator = '0x0000000000000000000000000000000000000000'
      const response = await request(app)
        .get(`/api/events?integrator=${nonExistentIntegrator}`)
        .expect(200)

      expect(response.body).toHaveLength(0)
    })

    it('should return 400 if integrator parameter is missing', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(400)
        .expect('Content-Type', /json/)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('integrator query parameter is required')
    })

    it('should return 400 if integrator address format is invalid', async () => {
      const response = await request(app)
        .get('/api/events?integrator=invalid-address')
        .expect(400)
        .expect('Content-Type', /json/)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Invalid integrator address format')
    })

    it('should return 400 if integrator address is too short', async () => {
      const response = await request(app)
        .get('/api/events?integrator=0x123')
        .expect(400)
        .expect('Content-Type', /json/)

      expect(response.body).toHaveProperty('error')
    })

    it('should return 400 if integrator address has invalid characters', async () => {
      const response = await request(app)
        .get('/api/events?integrator=0x123456789012345678901234567890123456789g')
        .expect(400)
        .expect('Content-Type', /json/)

      expect(response.body).toHaveProperty('error')
    })
  })
})
