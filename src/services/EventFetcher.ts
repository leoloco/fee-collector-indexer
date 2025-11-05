import { ethers, BigNumber } from 'ethers'
import { FeeCollector__factory } from 'lifi-contract-typings'
import { FeeCollectedEvent } from '../types/events'

export interface EventFetcherConfig {
  rpcUrl: string
  contractAddress: string
  chainId: number
}

/**
 * Fetches and parses FeeCollected events from the chain
 * Pure service - no state management, no error recovery
 * Throws errors for caller to handle
 */
export class EventFetcher {
  public provider: ethers.providers.JsonRpcProvider
  private contract: ethers.Contract
  private chainId: number

  constructor(config: EventFetcherConfig) {
    this.chainId = config.chainId
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl)
    this.contract = new ethers.Contract(
      config.contractAddress,
      FeeCollector__factory.createInterface(),
      this.provider
    )
  }

  /**
   * Fetches and parses events for a block range
   * Caller is responsible for chunking and error handling
   */
  async fetchEvents(fromBlock: number, toBlock: number): Promise<FeeCollectedEvent[]> {
    const filter = this.contract.filters.FeesCollected()
    const rawEvents = await this.contract.queryFilter(filter, fromBlock, toBlock)

    const events: FeeCollectedEvent[] = []
    for (const event of rawEvents) {
      const parsed = this.contract.interface.parseLog(event)
      const block = await event.getBlock()

      events.push({
        token: parsed.args[0].toLowerCase(),
        integrator: parsed.args[1].toLowerCase(),
        integratorFee: BigNumber.from(parsed.args[2]),
        lifiFee: BigNumber.from(parsed.args[3]),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash.toLowerCase(),
        logIndex: event.logIndex,
        timestamp: block.timestamp,
        chainId: this.chainId,
      })
    }

    return events
  }
}
