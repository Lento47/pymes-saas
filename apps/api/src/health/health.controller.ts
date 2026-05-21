import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";

const startedAt = new Date();

interface HealthCheck {
  status: "ok" | "error";
  detail?: string;
}

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Full health: delegates to ready() so load balancers get the real picture. */
  @Get()
  async get() {
    return this.ready();
  }

  /** Liveness: always returns 200 if the process is alive (K8s liveness probe). */
  @Get("live")
  live() {
    return {
      status: "ok",
      service: "pymes-api",
      uptime_seconds: Math.floor(process.uptime()),
      started_at: startedAt.toISOString(),
      timestamp: new Date().toISOString(),
      version: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
    };
  }

  /** Readiness: checks all dependencies. Returns 503 if anything is broken (K8s readiness probe). */
  @Get("ready")
  async ready() {
    const checks: Record<string, HealthCheck> = {};

    await this.checkDatabase(checks);
    this.checkRequiredConfig(checks);
    this.checkStorageConfig(checks);
    this.checkRedisConfig(checks);
    this.checkMemory(checks);

    const ready = Object.values(checks).every((check) => check.status === "ok");
    const response = {
      status: ready ? "ok" : "error",
      service: "pymes-api",
      uptime_seconds: Math.floor(process.uptime()),
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
    };

    if (!ready) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  // ── Private checkers ──

  private async checkDatabase(checks: Record<string, HealthCheck>) {
    try {
      const start = Date.now();
      await this.prisma.rawQuery<Array<{ ok: number }>>("SELECT 1 AS ok");
      checks.database = { status: "ok", detail: `${Date.now() - start}ms` };
    } catch (error) {
      checks.database = {
        status: "error",
        detail: error instanceof Error ? error.message : "Database check failed",
      };
    }
  }

  private checkRequiredConfig(checks: Record<string, HealthCheck>) {
    const required = ["DATABASE_URL", "JWT_SECRET"];
    const missing = required.filter((key) => !this.config.get<string>(key));
    checks.config = {
      status: missing.length === 0 ? "ok" : "error",
      detail: missing.length === 0 ? undefined : `Missing required env: ${missing.join(", ")}`,
    };
  }

  private checkStorageConfig(checks: Record<string, HealthCheck>) {
    const driver = this.config.get<string>("STORAGE_DRIVER") ?? "local";

    if (driver === "s3" || driver === "minio") {
      const missing = ["STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"].filter(
        (key) => !this.config.get<string>(key),
      );
      checks.storage = {
        status: missing.length === 0 ? "ok" : "error",
        detail: missing.length === 0 ? driver : `Missing storage env: ${missing.join(", ")}`,
      };
      return;
    }

    checks.storage = { status: "ok", detail: driver };
  }

  private checkRedisConfig(checks: Record<string, HealthCheck>) {
    const hasRedis = !!(
      this.config.get<string>("REDIS_URL") ||
      this.config.get<string>("REDIS_HOST") ||
      this.config.get<string>("UPSTASH_REDIS_REST_URL")
    );

    // Redis is optional — degrade gracefully instead of failing readiness.
    checks.redis = {
      status: "ok",
      detail: hasRedis ? "configured" : "Not configured. Queueing, throttling, and workers may be unavailable.",
    };
  }

  private checkMemory(checks: Record<string, HealthCheck>) {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const percent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

    const status: "ok" | "error" = percent > 90 ? "error" : "ok";

    checks.memory = {
      status,
      detail: `heap ${heapUsedMB}/${heapTotalMB}MB (${percent}%) · rss ${rssMB}MB`,
    };
  }
}
