import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";

const MAX_CONSECUTIVE_FAILURES = 3;
const PING_TIMEOUT_MS = 5_000;

export type FlowiseStatus = "HEALTHY" | "DEGRADED" | "UNKNOWN";

@Injectable()
export class FlowiseHealthService {
  private readonly logger = new Logger(FlowiseHealthService.name);
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  private consecutiveFailures = 0;
  private _status: FlowiseStatus = "UNKNOWN";
  private lastCheckedAt: Date | null = null;

  readonly FALLBACK_MESSAGE =
    "Lo siento, el asistente automático no está disponible en este momento. Un agente humano te atenderá pronto.";

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>("FLOWISE_BASE_URL") ?? "http://localhost:3001";
    this.enabled = config.get<string>("FLOWISE_ENABLED") === "true";
  }

  get status(): FlowiseStatus {
    return this._status;
  }

  get isHealthy(): boolean {
    return this._status === "HEALTHY";
  }

  get isDegraded(): boolean {
    return this._status === "DEGRADED";
  }

  @Cron("*/30 * * * * *") // every 30 seconds
  async checkHealth(): Promise<void> {
    if (!this.enabled) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/v1/ping`, {
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok || res.status === 401) {
        // 401 means Flowise is up but requires auth — still healthy
        this.onSuccess();
      } else {
        this.onFailure(`HTTP ${res.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.onFailure(msg);
    } finally {
      clearTimeout(timer);
      this.lastCheckedAt = new Date();
    }
  }

  getHealthReport(): { status: FlowiseStatus; consecutiveFailures: number; lastCheckedAt: Date | null } {
    return { status: this._status, consecutiveFailures: this.consecutiveFailures, lastCheckedAt: this.lastCheckedAt };
  }

  private onSuccess(): void {
    const wasDown = this._status === "DEGRADED";
    this.consecutiveFailures = 0;
    this._status = "HEALTHY";
    if (wasDown) {
      this.logger.log("[flowise-health] Service RECOVERED — status back to HEALTHY");
    }
  }

  private onFailure(reason: string): void {
    this.consecutiveFailures++;
    this.logger.warn(
      `[flowise-health] Ping failed (${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${reason}`,
    );

    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && this._status !== "DEGRADED") {
      this._status = "DEGRADED";
      this.logger.error(
        `[flowise-health] DEGRADED after ${this.consecutiveFailures} consecutive failures`,
      );
    }
  }
}
