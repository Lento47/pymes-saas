/**
 * WhatsApp Cloud API rate limiter.
 *
 * Meta imposes throughput limits per phone number:
 * - Default: 80 messages/second
 * - Upgraded: up to 1,000 messages/second
 *
 * This limiter uses a sliding window approach with configurable
 * max messages per second per phoneNumberId.
 */

import { Injectable, Logger } from '@nestjs/common';

interface RateLimitWindow {
  count: number;
  resetAt: number; // epoch ms
}

@Injectable()
export class WhatsAppRateLimiter {
  private readonly logger = new Logger(WhatsAppRateLimiter.name);
  private readonly windows = new Map<string, RateLimitWindow>();

  /** Default: 80 messages/second per number */
  private readonly defaultMaxPerSecond = 80;

  /** Cleanup interval: prune stale windows every 5 minutes */
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Check if a message can be sent for the given phone number.
   * Returns false if the rate limit would be exceeded.
   */
  canSend(phoneNumberId: string, maxPerSecond?: number): boolean {
    const max = maxPerSecond ?? this.defaultMaxPerSecond;
    const now = Date.now();
    const key = `whatsapp:rate:${phoneNumberId}`;

    let window = this.windows.get(key);

    if (!window || now >= window.resetAt) {
      // New window
      window = { count: 1, resetAt: now + 1000 };
      this.windows.set(key, window);
      return true;
    }

    if (window.count >= max) {
      // Over limit — must wait for next window
      return false;
    }

    window.count++;
    return true;
  }

  /**
   * Wait until the rate limit allows sending.
   * Returns a Promise that resolves when it's safe to send.
   */
  async waitForSlot(
    phoneNumberId: string,
    maxPerSecond?: number,
    maxWaitMs = 10_000,
  ): Promise<boolean> {
    const started = Date.now();

    while (!this.canSend(phoneNumberId, maxPerSecond)) {
      if (Date.now() - started > maxWaitMs) {
        this.logger.warn(
          `Rate limit wait timeout for ${phoneNumberId} after ${maxWaitMs}ms`,
        );
        return false;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    return true;
  }

  /**
   * Get current usage for a phone number (for monitoring)
   */
  getCurrentUsage(phoneNumberId: string): { used: number; max: number } {
    const key = `whatsapp:rate:${phoneNumberId}`;
    const window = this.windows.get(key);
    const now = Date.now();

    if (!window || now >= window.resetAt) {
      return { used: 0, max: this.defaultMaxPerSecond };
    }

    return { used: window.count, max: this.defaultMaxPerSecond };
  }

  /**
   * Get all active rate limit windows (for dashboard)
   */
  getAllUsage(): Array<{
    phoneNumberId: string;
    used: number;
    max: number;
    remaining: number;
  }> {
    const now = Date.now();
    const result: Array<{
      phoneNumberId: string;
      used: number;
      max: number;
      remaining: number;
    }> = [];

    for (const [key, window] of this.windows.entries()) {
      if (now >= window.resetAt) continue;
      const phoneNumberId = key.replace('whatsapp:rate:', '');
      result.push({
        phoneNumberId,
        used: window.count,
        max: this.defaultMaxPerSecond,
        remaining: Math.max(0, this.defaultMaxPerSecond - window.count),
      });
    }

    return result;
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, window] of this.windows.entries()) {
        if (now >= window.resetAt) {
          this.windows.delete(key);
        }
      }
    }, 5 * 60 * 1000); // every 5 min
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
