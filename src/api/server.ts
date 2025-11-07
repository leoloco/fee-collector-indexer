import express, { Application } from 'express'
import { router } from './routes'
import { errorHandler } from './middleware'
import { logger } from '../utils/logger'

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express()

  // Parse JSON request bodies
  app.use(express.json())

  // Health check endpoint (for Docker healthcheck)
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  // Mount routes
  app.use('/api', router)

  // Error handling middleware
  app.use(errorHandler)

  return app
}

/**
 * Start the API server
 * @param port - Port number to listen on
 * @returns The Express application instance
 */
export function startServer(port: number): Application {
  const app = createApp()

  app.listen(port, () => {
    logger.info(`API server listening on port ${port}`)
    logger.info(`Endpoint: GET /api/events?integrator=0x...`)
  })

  return app
}
