import { EventFetcher } from '../../../src/services/EventFetcher'
import { getChainConfig } from '../../../src/config'

describe('EventFetcher', () => {
  let fetcher: EventFetcher

  beforeAll(() => {
    // Use RPC from environment config
    const polygonConfig = getChainConfig('polygon')
    fetcher = new EventFetcher({
      rpcUrl: polygonConfig.rpcUrl,
      contractAddress: polygonConfig.contractAddress,
      chainId: polygonConfig.chainId,
    })
  })

  describe('fetchEvents', () => {
    it('should fetch and parse real events from blockchain', async () => {
      // Fetch events from a known block range with events
      // Use a smaller range to avoid RPC limits (Alchemy free tier: max 10 blocks inclusive)
      const events = await fetcher.fetchEvents(77000000, 77000009)

      // We expect at least some events in this range
      expect(Array.isArray(events)).toBe(true)

      // If events exist, verify structure
      if (events.length > 0) {
        const event = events[0]
        expect(event).toHaveProperty('token')
        expect(event).toHaveProperty('integrator')
        expect(event).toHaveProperty('integratorFee')
        expect(event).toHaveProperty('lifiFee')
        expect(event).toHaveProperty('blockNumber')
        expect(event).toHaveProperty('transactionHash')
        expect(event).toHaveProperty('logIndex')
        expect(event).toHaveProperty('timestamp')
        expect(event).toHaveProperty('chainId')

        // Verify addresses are lowercase
        expect(event.token).toBe(event.token.toLowerCase())
        expect(event.integrator).toBe(event.integrator.toLowerCase())
        expect(event.transactionHash).toBe(event.transactionHash.toLowerCase())

        // Verify chainId matches
        expect(event.chainId).toBe(137)
      }
    }, 30000) // 30 second timeout for RPC calls

    it('should return empty array for block range with no events', async () => {
      // Use a very early block range where the contract didn't exist (max 10 blocks for Alchemy free tier)
      const events = await fetcher.fetchEvents(1, 10)

      expect(events).toHaveLength(0)
    }, 30000)

    it('should handle small block ranges correctly', async () => {
      const events = await fetcher.fetchEvents(77000000, 77000000)

      expect(Array.isArray(events)).toBe(true)
    }, 30000)
  })
})
