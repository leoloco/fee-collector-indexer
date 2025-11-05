import mongoose from 'mongoose'
import { getConfig } from './config'
import { logger } from './utils/logger'

/**
 * Connect to MongoDB using the configured connection URI
 * This is the production database connection (not for tests)
 */
export const connectDB = async (): Promise<void> => {
  const config = getConfig()

  try {
    await mongoose.connect(config.mongodbUri)
    logger.info('MongoDB connected successfully')
  } catch (error) {
    logger.error(
      'MongoDB connection error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw error
  }

  // Handle connection errors after initial connection
  mongoose.connection.on('error', error => {
    logger.error('MongoDB connection error:', error)
  })

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected')
  })

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected')
  })
}

/**
 * Disconnect from MongoDB
 * Used for graceful shutdown
 */
export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect()
  logger.info('MongoDB disconnected')
}
