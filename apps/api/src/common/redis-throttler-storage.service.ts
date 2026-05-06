import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private redis: Redis | null = null;

  constructor() {
    // ────────────────────────────────────────────────────────────────────
    // IMPORTANTE — DEFAULT A localhost:6379 PARA DEV.
    // EN PRODUCCION SETEAR `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
    // CON LAS CREDENCIALES DEL REDIS MANEJADO (Railway/Upstash/etc).
    // SI NO SE PUEDE CONECTAR, EL THROTTLER CAE A IN-MEMORY (PER-INSTANCE),
    // QUE NO SIRVE EN MULTI-REPLICA — EL RATE LIMIT SE FRAGMENTA POR REPLICA.
    // ────────────────────────────────────────────────────────────────────
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;
    const username = process.env.REDIS_USERNAME || undefined;

    try {
      this.redis = new Redis({
        host,
        port,
        password,
        username,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });
      this.redis.on('error', () => {
        // Silently suppress — fallback to in-memory below
      });
      this.redis.connect().catch(() => {
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
    }
  }

  async increment(
    key: string,
    ttl: number,
    _limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    if (!this.redis) {
      // Fallback in-memory
      const store = (this as any)._memoryStore || ((this as any)._memoryStore = new Map());
      const record = store.get(key) || { hits: 0, resetAt: Date.now() + ttl * 1000 };
      if (Date.now() > record.resetAt) {
        record.hits = 1;
        record.resetAt = Date.now() + ttl * 1000;
      } else {
        record.hits++;
      }
      store.set(key, record);
      return {
        totalHits: record.hits,
        timeToExpire: Math.max(0, Math.ceil((record.resetAt - Date.now()) / 1000)),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    const redisKey = `throttle:${key}`;
    const multi = this.redis.multi();
    multi.incr(redisKey);
    multi.pttl(redisKey);

    const results = await multi.exec();
    const hits = (results?.[0]?.[1] as number) || 1;
    const pttl = (results?.[1]?.[1] as number) || -1;

    if (hits === 1 || pttl < 0) {
      await this.redis.expire(redisKey, ttl);
    }

    return {
      totalHits: hits,
      timeToExpire: Math.max(0, Math.ceil((pttl > 0 ? pttl : ttl * 1000) / 1000)),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
