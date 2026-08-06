// ─── Application Port ─────────────────────────────────────────────────────
// Contract for cache operations — implemented by Redis in infrastructure

export interface ICacheProvider {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /**
   * Atomically increments a counter. Creates the key if it doesn't exist.
   * Sets TTL only on first creation (if the key is new).
   */
  increment(key: string, ttlSeconds: number): Promise<number>;
}
