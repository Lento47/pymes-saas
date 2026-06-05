import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import Redis from "ioredis";

@Injectable()
export class CallRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(CallRateLimitGuard.name);
  private redis: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {
    const host = process.env.REDIS_HOST || "localhost";
    const port = parseInt(process.env.REDIS_PORT || "6379", 10);
    const password = process.env.REDIS_PASSWORD || undefined;
    const username = process.env.REDIS_USERNAME || undefined;

    try {
      this.redis = new Redis({ host, port, password, username, lazyConnect: true, retryStrategy: (t) => Math.min(t * 100, 3000) });
      this.redis.on("error", () => { this.redis = null; });
      this.redis.connect().catch(() => { this.redis = null; });
    } catch {
      this.redis = null;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.id;
    const calleeId: string | undefined = req.body?.to_user_id;

    if (!userId) return true;

    // ── Check 1: Max 3 outgoing calls per user per minute ──
    if (this.redis) {
      const key = `call_rate:user:${userId}`;
      const hits = await this.redis.incr(key);
      if (hits === 1) await this.redis.expire(key, 60);
      if (hits > 3) {
        this.logger.warn(`Rate limit exceeded for user ${userId}: ${hits} calls/min`);
        return false;
      }
    } else {
      // In-memory fallback (single instance only)
      const now = Date.now();
      const store = (this as any)._store ?? ((this as any)._store = new Map<string, number[]>());
      const calls: number[] = store.get(userId) ?? [];
      const recent = calls.filter((t) => now - t < 60_000);
      if (recent.length >= 3) {
        this.logger.warn(`Rate limit exceeded for user ${userId}: ${recent.length} calls/min`);
        return false;
      }
      recent.push(now);
      store.set(userId, recent);
    }

    // ── Check 2: Max 10 calls to the same callee per hour ──
    if (calleeId && this.redis) {
      const key = `call_rate:callee:${userId}:${calleeId}`;
      const hits = await this.redis.incr(key);
      if (hits === 1) await this.redis.expire(key, 3600);
      if (hits > 10) {
        this.logger.warn(`Rate limit exceeded: user ${userId} calling ${calleeId} ${hits} times/hour`);
        return false;
      }
    } else if (calleeId) {
      const now = Date.now();
      const store = (this as any)._calleeStore ?? ((this as any)._calleeStore = new Map<string, number[]>());
      const key = `${userId}:${calleeId}`;
      const calls: number[] = store.get(key) ?? [];
      const recent = calls.filter((t) => now - t < 3_600_000);
      if (recent.length >= 10) {
        this.logger.warn(`Rate limit exceeded: user ${userId} calling ${calleeId} ${recent.length} times/hour`);
        return false;
      }
      recent.push(now);
      store.set(key, recent);
    }

    return true;
  }
}
