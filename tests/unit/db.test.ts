import mongoose from 'mongoose'
import { connectDB, disconnectDB } from '../../src/db'
import { logger } from '../../src/utils/logger'

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

// Mock the config
jest.mock('../../src/config', () => ({
  getConfig: jest.fn(() => ({
    mongodbUri: 'mongodb://localhost:27017/test-db',
  })),
}))

describe('Database Connection', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(async () => {
    // Clean up any open connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
    process.env = originalEnv
  })

  describe('connectDB', () => {
    it('should connect to MongoDB successfully', async () => {
      await connectDB()

      expect(mongoose.connection.readyState).toBe(1) // 1 = connected
      expect(logger.info).toHaveBeenCalledWith('MongoDB connected successfully')
    })

    it('should throw error if connection fails', async () => {
      // Mock mongoose.connect to reject
      const mockError = new Error('Connection failed')
      jest.spyOn(mongoose, 'connect').mockRejectedValueOnce(mockError)

      await expect(connectDB()).rejects.toThrow('Connection failed')
      expect(logger.error).toHaveBeenCalledWith('MongoDB connection error:', 'Connection failed')
    })

    it('should handle non-Error objects when connection fails', async () => {
      // Mock mongoose.connect to reject with a non-Error object
      jest.spyOn(mongoose, 'connect').mockRejectedValueOnce('string error')

      await expect(connectDB()).rejects.toBe('string error')
      expect(logger.error).toHaveBeenCalledWith('MongoDB connection error:', 'Unknown error')
    })

    it('should set up connection event handlers', async () => {
      await connectDB()

      // Verify event listeners are registered
      const errorListeners = mongoose.connection.listeners('error')
      const disconnectedListeners = mongoose.connection.listeners('disconnected')
      const reconnectedListeners = mongoose.connection.listeners('reconnected')

      expect(errorListeners.length).toBeGreaterThan(0)
      expect(disconnectedListeners.length).toBeGreaterThan(0)
      expect(reconnectedListeners.length).toBeGreaterThan(0)
    })

    it('should log error when connection error event occurs', async () => {
      await connectDB()
      jest.clearAllMocks()

      const testError = new Error('Connection error')
      mongoose.connection.emit('error', testError)

      expect(logger.error).toHaveBeenCalledWith('MongoDB connection error:', testError)
    })

    it('should log warning when disconnected event occurs', async () => {
      await connectDB()
      jest.clearAllMocks()

      mongoose.connection.emit('disconnected')

      expect(logger.warn).toHaveBeenCalledWith('MongoDB disconnected')
    })

    it('should log info when reconnected event occurs', async () => {
      await connectDB()
      jest.clearAllMocks()

      mongoose.connection.emit('reconnected')

      expect(logger.info).toHaveBeenCalledWith('MongoDB reconnected')
    })
  })

  describe('disconnectDB', () => {
    it('should disconnect from MongoDB successfully', async () => {
      await connectDB()
      expect(mongoose.connection.readyState).toBe(1)

      jest.clearAllMocks()
      await disconnectDB()

      expect(mongoose.connection.readyState).toBe(0) // 0 = disconnected
      expect(logger.info).toHaveBeenCalledWith('MongoDB disconnected')
    })

    it('should handle disconnect when not connected', async () => {
      // Ensure we're not connected
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect()
      }

      await disconnectDB()

      expect(logger.info).toHaveBeenCalledWith('MongoDB disconnected')
    })
  })
})
