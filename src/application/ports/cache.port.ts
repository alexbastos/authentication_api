// ─── Application Port ─────────────────────────────────────────────────────
// Contract for cache operations — implemented by Redis in infrastructure

export interface ICacheProvider {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
