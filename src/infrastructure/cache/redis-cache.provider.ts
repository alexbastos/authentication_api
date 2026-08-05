// ─── Redis Cache Provider ─────────────────────────────────────────────────

import Redis from 'ioredis';
import type { ICacheProvider } from '../../application/ports/cache.port.js';

export class RedisCacheProvider implements ICacheProvider {
  private client: Redis;

  constructor(config: { host: string; port: number; password?: string; db?: number }) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password || undefined,
      db: config.db ?? 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    this.client.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }
}
