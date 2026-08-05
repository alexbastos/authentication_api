// ─── Application Port ─────────────────────────────────────────────────────
// Contract for password hashing — implemented by infrastructure layer

export interface IHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
}
