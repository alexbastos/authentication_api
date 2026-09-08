// ─── Application Port ─────────────────────────────────────────────────────
// Contract for password hashing — implemented by infrastructure layer

export interface IHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
  /** Performs the same configured-cost work for an account that does not exist. */
  dummyCompare?(plain: string): Promise<boolean>;
  /** Signals that a valid legacy hash should be upgraded after authentication. */
  needsRehash?(hashed: string): boolean;
}
