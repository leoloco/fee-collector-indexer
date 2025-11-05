import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

let mongoServer: MongoMemoryServer

/**
 * Connect to in-memory MongoDB instance for testing
 */
export const connectTestDB = async (): Promise<void> => {
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()

  await mongoose.connect(mongoUri)
}

/**
 * Clear all collections in the test database
 * Used between tests to ensure clean state
 */
export const clearTestDB = async (): Promise<void> => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
}

/**
 * Close database connection and stop in-memory server
 * Should be called after all tests complete
 */
export const closeTestDB = async (): Promise<void> => {
  await mongoose.disconnect()
  if (mongoServer) {
    await mongoServer.stop()
  }
}
