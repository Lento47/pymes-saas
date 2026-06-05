import { Controller, Get, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import v8 from "node:v8";

const startedAt = new Date();

interface HealthCheck {
  status: "ok" | "warn" | "error";
  detail?: string;
}

@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Full health: delegates to ready() so load balancers get the real picture. */
  @Get()
  async get() {
    return this.ready();
  }

  /** Liveness: always 200 if process is alive. */
  @Get("live")
  live() {
    return {
      status: "ok",
      service: "pymes-api",
      uptime_seconds: Math.floor(process.uptime()),
      started_at: startedAt.toISOString(),
      timestamp: new Date().toISOString(),
      version: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
      env: process.env.NODE_ENV ?? "development",
    };
  }

  /** Readiness: checks all dependencies. Returns 200 always; use `healthy` boolean. */
  @Get("ready")
  async ready() {
    const checks: Record<string, HealthCheck> = {};

    await this.checkDatabase(checks);
    this.checkRedisConfig(checks);
    this.checkStorageConfig(checks);
    this.checkPayPalConfig(checks);
    this.checkEmailConfig(checks);
    this.checkWhatsAppConfig(checks);
    this.checkTelegramConfig(checks);
    this.checkRequiredConfig(checks);
    this.checkMemory(checks);

    const errors = Object.values(checks).filter((c) => c.status === "error");
    const warnings = Object.values(checks).filter((c) => c.status === "warn");
    const healthy = errors.length === 0;

    if (!healthy) {
      const failures = Object.entries(checks)
        .filter(([, c]) => c.status === "error")
        .map(([name, c]) => `${name}: ${c.detail}`)
        .join("; ");
      this.logger.warn(`Health check degraded: ${failures}`);
    }

    return {
      status: healthy ? (warnings.length > 0 ? "degraded" : "ok") : "unhealthy",
      healthy,
      service: "pymes-api",
      uptime_seconds: Math.floor(process.uptime()),
      env: process.env.NODE_ENV ?? "development",
      version: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
      checks,
      summary: {
        ok: Object.values(checks).filter((c) => c.status === "ok").length,
        warn: warnings.length,
        error: errors.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ── Private checkers ────────────────────────────────────────────────────────

  private async checkDatabase(checks: Record<string, HealthCheck>) {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: "ok", detail: `${Date.now() - start}ms` };
    } catch (error) {
      checks.database = {
        status: "error",
        detail: error instanceof Error ? error.message : "Database unreachable",
      };
    }
  }

  private checkRedisConfig(checks: Record<string, HealthCheck>) {
    const hasRedis = !!(
      this.config.get<string>("REDIS_URL") ||
      this.config.get<string>("REDIS_HOST") ||
      this.config.get<string>("UPSTASH_REDIS_REST_URL")
    );
    checks.redis = hasRedis
      ? { status: "ok", detail: "configured" }
      : { status: "warn", detail: "not configured — throttling and session caching use in-memory fallback" };
  }

  private checkStorageConfig(checks: Record<string, HealthCheck>) {
    const driver = this.config.get<string>("STORAGE_DRIVER") ?? "local";
    if (driver === "s3" || driver === "minio") {
      const missing = ["STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"].filter(
        (key) => !this.config.get<string>(key),
      );
      checks.storage = missing.length === 0
        ? { status: "ok", detail: driver }
        : { status: "error", detail: `Missing storage env: ${missing.join(", ")}` };
    } else {
      checks.storage = { status: "warn", detail: `driver=${driver} — local storage not suitable for multi-instance deployments` };
    }
  }

  private checkPayPalConfig(checks: Record<string, HealthCheck>) {
    const missing = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"].filter(
      (k) => !this.config.get<string>(k),
    );
    const env = this.config.get<string>("PAYPAL_ENVIRONMENT") ?? "sandbox";
    if (missing.length > 0) {
      checks.paypal = { status: "error", detail: `Missing: ${missing.join(", ")}` };
    } else if (env === "sandbox" && process.env.NODE_ENV === "production") {
      checks.paypal = { status: "warn", detail: "PayPal in sandbox mode on production environment" };
    } else {
      checks.paypal = { status: "ok", detail: `env=${env}` };
    }
  }

  private checkEmailConfig(checks: Record<string, HealthCheck>) {
    const resendKey = this.config.get<string>("RESEND_API_KEY");
    if (!resendKey) {
      checks.email = { status: "warn", detail: "RESEND_API_KEY not set — verification/reset emails will not send" };
    } else {
      checks.email = { status: "ok", detail: "resend configured" };
    }
  }

  private checkWhatsAppConfig(checks: Record<string, HealthCheck>) {
    const verifyToken = this.config.get<string>("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
    if (!verifyToken) {
      checks.whatsapp_webhook = {
        status: "warn",
        detail: "WHATSAPP_WEBHOOK_VERIFY_TOKEN not set — webhook verification disabled",
      };
    } else {
      checks.whatsapp_webhook = { status: "ok", detail: "verify token configured" };
    }
  }

  private checkTelegramConfig(checks: Record<string, HealthCheck>) {
    const encKey = this.config.get<string>("ENCRYPTION_KEY");
    if (!encKey) {
      checks.telegram = { status: "error", detail: "ENCRYPTION_KEY not set — bot tokens cannot be encrypted" };
    } else {
      checks.telegram = { status: "ok", detail: "encryption key configured" };
    }
  }

  private checkRequiredConfig(checks: Record<string, HealthCheck>) {
    const required = [
      "DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET",
      "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET",
    ];
    const missing = required.filter((key) => !this.config.get<string>(key));
    checks.config_required = {
      status: missing.length === 0 ? "ok" : "error",
      detail: missing.length === 0 ? "all required vars present" : `Missing: ${missing.join(", ")}`,
    };
  }

  private checkMemory(checks: Record<string, HealthCheck>) {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const heapLimitMB = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const pct = Math.round((usage.heapUsed / v8.getHeapStatistics().heap_size_limit) * 100);
    const status: HealthCheck["status"] = pct > 90 ? "error" : pct > 75 ? "warn" : "ok";
    checks.memory = {
      status,
      detail: `heap ${heapUsedMB}/${heapTotalMB}MB (${heapLimitMB}MB limit, ${pct}%) rss=${rssMB}MB`,
    };
  }
}
