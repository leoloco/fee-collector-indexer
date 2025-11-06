import { Router, Request, Response } from 'express'
import { getModelForClass } from '@typegoose/typegoose'
import { ethers } from 'ethers'
import { FeeCollectedEvent } from '../models'
import { logger } from '../utils/logger'

const FeeCollectedEventModel = getModelForClass(FeeCollectedEvent)

const router = Router()

/**
 * GET /events?integrator=0x...
 * Retrieve all fee collection events for a given integrator
 *
 * Query parameters:
 * - integrator (required): The integrator address to filter by
 *
 * Returns:
 * - Array of FeeCollectedEvent objects
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const integratorParam = req.query.integrator as string

    // Validate integrator parameter is provided
    if (!integratorParam) {
      return res.status(400).json({ error: 'integrator query parameter is required' })
    }

    // Validate address format using ethers
    if (!ethers.utils.isAddress(integratorParam)) {
      return res.status(400).json({
        error: 'Invalid integrator address format. Must be a valid Ethereum address (0x...)',
      })
    }

    // Normalize to lowercase for case-insensitive matching
    const integrator = integratorParam.toLowerCase()

    logger.debug(`Querying events for integrator: ${integrator}`)

    // Query events for the given integrator
    const events = await FeeCollectedEventModel.find({ integrator })
      .sort({ blockNumber: 1, logIndex: 1 }) // Chronological order
      .lean()
      .exec()

    return res.json(events)
  } catch (error) {
    logger.error('Error fetching events:', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: 'Failed to fetch events' })
  }
})

export { router }
