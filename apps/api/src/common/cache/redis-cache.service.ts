import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import * as crypto from "crypto";
import Redis from "ioredis";

const FAQ_TTL_SECONDS = 7 * 24 * 3600; // 7 days

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis | null = null;

  constructor() {
    const host = process.env.REDIS_HOST || "localhost";
    const port = parseInt(process.env.REDIS_PORT || "6379", 10);
    const password = process.env.REDIS_PASSWORD || undefined;
    const username = process.env.REDIS_USERNAME || undefined;

    try {
      this.redis = new Redis({
        host,
        port,
        password,
        username,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 200, 5000),
        maxRetriesPerRequest: 1,
      });
      this.redis.on("error", () => undefined); // suppress — silently degrade without cache
      this.redis.connect().catch(() => {
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  // ── FAQ cache ────────────────────────────────────────────────────────────────

  /** Hash a customer query for cache key (workspace-scoped). */
  private faqKey(workspaceId: string, query: string): string {
    const hash = crypto.createHash("sha256").update(query.toLowerCase().trim()).digest("hex").slice(0, 16);
    return `cache:faq:${workspaceId}:${hash}`;
  }

  async getFaqResponse(workspaceId: string, query: string): Promise<string | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.get(this.faqKey(workspaceId, query));
    } catch {
      return null;
    }
  }

  async setFaqResponse(workspaceId: string, query: string, response: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(this.faqKey(workspaceId, query), FAQ_TTL_SECONDS, response);
    } catch {
      // Non-fatal — cache miss is fine
    }
  }

  async invalidateFaqCache(workspaceId: string): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(`cache:faq:${workspaceId}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`[faq-cache] Invalidated ${keys.length} keys for workspace ${workspaceId}`);
      }
    } catch {
      // Non-fatal
    }
  }

  // ── Generic cache helpers ────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, ttlSeconds, value);
    } catch {
      // Non-fatal
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch {
      // Non-fatal
    }
  }
}
