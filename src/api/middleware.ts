import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

/**
 * Global error handling middleware
 * Catches errors thrown in route handlers and returns consistent error responses
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error(`API Error on ${req.method} ${req.path}:`, err.message)

  if (err.stack) {
    logger.debug(err.stack)
  }

  res.status(500).json({ error: 'Internal server error' })
}
