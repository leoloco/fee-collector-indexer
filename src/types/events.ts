import { BigNumber } from 'ethers'

/**
 * Generic EVM event metadata
 * Reusable for any event parsing in the future
 */
export interface EventMetadata {
  blockNumber: number
  transactionHash: string
  logIndex: number
  timestamp: number
  chainId: number
}

/**
 * Fee collection event data
 * Specific to FeeCollector contract's FeesCollected event
 */
export interface FeeCollectedEvent extends EventMetadata {
  token: string
  integrator: string
  integratorFee: BigNumber
  lifiFee: BigNumber
}
