import { prop, modelOptions, Severity } from '@typegoose/typegoose'

/**
 * Typegoose model for tracking indexer state per chain.
 *
 * This model stores the last successfully processed block number for each chain,
 * allowing the indexer to resume from where it left off and avoid re-scanning blocks.
 *
 * Only one document should exist per chainId (enforced by unique index).
 */
@modelOptions({
  schemaOptions: {
    collection: 'indexer_states',
    timestamps: true,
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
})
export class IndexerState {
  /**
   * Chain ID for this indexer state (e.g., 137 for Polygon)
   */
  @prop({ required: true, unique: true })
  public chainId!: number

  /**
   * Last block number that was successfully processed and stored
   */
  @prop({ required: true })
  public lastProcessedBlock!: number

  /**
   * Timestamp when this document was created (auto-managed by timestamps: true)
   */
  public createdAt?: Date

  /**
   * Timestamp when this document was last updated (auto-managed by timestamps: true)
   */
  public updatedAt?: Date
}
