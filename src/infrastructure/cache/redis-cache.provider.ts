// ─── Redis Cache Provider ─────────────────────────────────────────────────

import Redis from 'ioredis';
import type { ICacheProvider } from '../../application/ports/cache.port.js';

export class RedisCacheProvider implements ICacheProvider {
  private client: Redis;

  constructor(config: { host: string; port: number; password?: string; db?: number; tls?: boolean }) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password || undefined,
      db: config.db ?? 0,
      ...(config.tls ? { tls: {} } : {}),
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

  async getAndDelete(key: string): Promise<string | null> {
    return this.client.getdel(key);
  }

  async consumeIfValueMatches(key: string, expectedValue: string): Promise<boolean> {
    const result = await this.client.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      1,
      key,
      expectedValue,
    );
    return result === 1;
  }

  async setIfNotExists(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.eval(
      "local value = redis.call('INCR', KEYS[1]); if value == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return value",
      1,
      key,
      ttlSeconds,
    );
    return Number(count);
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }
}
