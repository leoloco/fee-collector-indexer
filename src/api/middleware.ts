import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

/**
 * Global error handling middleware
 *
 * Safety net for unexpected errors. Current routes have try-catch blocks, but this catches:
 * 1. Errors in future routes without try-catch
 * 2. Synchronous errors outside try-catch blocks
 * 3. Unexpected errors (e.g., MongoDB connection drops mid-query)
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error(`API Error on ${req.method} ${req.path}:`, err.message)

  if (err.stack) {
    logger.debug(err.stack)
  }

  res.status(500).json({ error: 'Internal server error' })
}
