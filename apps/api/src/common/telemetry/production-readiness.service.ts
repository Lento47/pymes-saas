import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ReadinessItem {
  key: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

/**
 * Checks production readiness without exposing secrets.
 * Never returns actual values — only "configured" / "missing" / status flags.
 */
@Injectable()
export class ProductionReadinessService {
  constructor(private readonly config: ConfigService) {}

  check(): { items: ReadinessItem[]; ready: boolean; score: number } {
    const items: ReadinessItem[] = [
      // ── Required env vars ──────────────────────────────────────────────────
      this.checkRequired("DATABASE_URL", "PostgreSQL connection string"),
      this.checkRequired("JWT_SECRET", "JWT signing secret"),
      this.checkRequired("JWT_REFRESH_SECRET", "JWT refresh secret"),
      this.checkRequired("ENCRYPTION_KEY", "Data encryption key (Telegram bot tokens etc.)"),
      this.checkRequired("PAYPAL_CLIENT_ID", "PayPal client ID"),
      this.checkRequired("PAYPAL_CLIENT_SECRET", "PayPal client secret"),

      // ── Optional but important ─────────────────────────────────────────────
      this.checkOptional("RESEND_API_KEY", "Resend email API key", "email verification and password reset will not send"),
      this.checkOptional("REDIS_HOST", "Redis host", "rate limiting and SAML sessions use in-memory fallback"),
      this.checkOptional("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "WhatsApp webhook verify token", "webhook verification disabled"),
      this.checkOptional("CORS_ORIGIN", "CORS origin(s)", "defaults to localhost — set for production"),
      this.checkOptional("APP_URL", "App base URL", "used in email links — defaults to pymeshub.lat"),

      // ── PayPal environment ─────────────────────────────────────────────────
      this.checkPayPalEnv(),

      // ── Storage ────────────────────────────────────────────────────────────
      this.checkStorage(),

      // ── Railway / deployment ───────────────────────────────────────────────
      this.checkNodeEnv(),
      this.checkOptional("PORT", "HTTP port", "defaults to 4000"),
    ];

    const errors = items.filter((i) => i.status === "error").length;
    const warns = items.filter((i) => i.status === "warn").length;
    const total = items.length;
    const score = Math.round(((total - errors - warns * 0.5) / total) * 100);
    const ready = errors === 0;

    return { items, ready, score };
  }

  private checkRequired(key: string, label: string): ReadinessItem {
    return {
      key,
      label,
      status: this.config.get<string>(key) ? "ok" : "error",
      detail: this.config.get<string>(key) ? "configured" : `Missing: ${key}`,
    };
  }

  private checkOptional(key: string, label: string, warningDetail: string): ReadinessItem {
    return {
      key,
      label,
      status: this.config.get<string>(key) ? "ok" : "warn",
      detail: this.config.get<string>(key) ? "configured" : warningDetail,
    };
  }

  private checkPayPalEnv(): ReadinessItem {
    const env = this.config.get<string>("PAYPAL_ENVIRONMENT") ?? "sandbox";
    const isProduction = process.env.NODE_ENV === "production";
    return {
      key: "PAYPAL_ENVIRONMENT",
      label: "PayPal environment",
      status: isProduction && env === "sandbox" ? "warn" : "ok",
      detail: isProduction && env === "sandbox"
        ? `sandbox on NODE_ENV=production — set PAYPAL_ENVIRONMENT=live for real billing`
        : env,
    };
  }

  private checkStorage(): ReadinessItem {
    const driver = this.config.get<string>("STORAGE_DRIVER") ?? "local";
    if (driver === "s3" || driver === "minio") {
      const ok = ["STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"].every(
        (k) => this.config.get<string>(k),
      );
      return {
        key: "STORAGE",
        label: `Object storage (${driver})`,
        status: ok ? "ok" : "error",
        detail: ok ? `${driver} configured` : "Missing STORAGE_BUCKET, STORAGE_ACCESS_KEY, or STORAGE_SECRET_KEY",
      };
    }
    return {
      key: "STORAGE",
      label: "File storage",
      status: process.env.NODE_ENV === "production" ? "warn" : "ok",
      detail: `driver=${driver} — use s3 or minio for production multi-instance deployments`,
    };
  }

  private checkNodeEnv(): ReadinessItem {
    const env = process.env.NODE_ENV;
    return {
      key: "NODE_ENV",
      label: "Node environment",
      status: env === "production" ? "ok" : "warn",
      detail: env ?? "not set — should be 'production' in deployment",
    };
  }
}
