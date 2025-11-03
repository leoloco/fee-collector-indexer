import { prop, index, modelOptions, Severity } from '@typegoose/typegoose'

/**
 * Typegoose model for storing FeeCollected events from the FeeCollector smart contract.
 *
 * Each document represents a single FeesCollected event emitted by the contract.
 * The composite index on chainId, blockNumber, transactionHash, and logIndex ensures
 * uniqueness and prevents duplicate event storage.
 */
@modelOptions({
  schemaOptions: {
    collection: 'fee_collected_events',
    timestamps: true,
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
})
@index({ chainId: 1, blockNumber: 1, transactionHash: 1, logIndex: 1 }, { unique: true })
@index({ integrator: 1, chainId: 1 })
@index({ blockNumber: 1 })
@index({ createdAt: 1 })
export class FeeCollectedEvent {
  /**
   * Address of the token that fees were collected in
   */
  @prop({ required: true, lowercase: true })
  public token!: string

  /**
   * Address of the integrator for whom fees were collected
   */
  @prop({ required: true, lowercase: true })
  public integrator!: string

  /**
   * Amount of fees collected for the integrator (stored as string to preserve precision)
   */
  @prop({ required: true })
  public integratorFee!: string

  /**
   * Amount of fees collected for LI.FI (stored as string to preserve precision)
   */
  @prop({ required: true })
  public lifiFee!: string

  /**
   * Block number where the event was emitted
   */
  @prop({ required: true })
  public blockNumber!: number

  /**
   * Transaction hash where the event was emitted
   */
  @prop({ required: true, lowercase: true })
  public transactionHash!: string

  /**
   * Log index within the transaction (for event ordering)
   */
  @prop({ required: true })
  public logIndex!: number

  /**
   * Timestamp of the block (Unix timestamp in seconds)
   */
  @prop({ required: true })
  public timestamp!: number

  /**
   * Chain ID where the event occurred (e.g., 137 for Polygon)
   */
  @prop({ required: true })
  public chainId!: number

  /**
   * Timestamp when this document was created (auto-managed by timestamps: true)
   */
  public createdAt?: Date

  /**
   * Timestamp when this document was last updated (auto-managed by timestamps: true)
   */
  public updatedAt?: Date
}
