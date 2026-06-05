import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";
import { REQUEST_ID_HEADER } from "./request-id.middleware";

// Paths to skip from access logs (too noisy)
const SILENT_PATHS = new Set(["/api/health", "/api/health/live", "/api/health/ready"]);

// Headers that must never appear in logs
const SENSITIVE_HEADERS = new Set([
  "authorization", "cookie", "x-api-key", "x-webhook-secret",
  "paypal-transmission-id", "paypal-auth-algo", "paypal-cert-url",
]);

@Injectable()
export class TelemetryMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string; user?: { id?: string; workspace_id?: string } }, res: Response, next: () => void) {
    const start = Date.now();
    const { method, path } = req;

    if (SILENT_PATHS.has(path)) { next(); return; }

    res.on("finish", () => {
      const statusCode = res.statusCode;
      const level =
        statusCode >= 500 ? "error" :
        statusCode >= 400 ? "warn" : "info";

      const log: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level,
        method,
        path,
        status: statusCode,
        duration_ms: Date.now() - start,
        request_id: req.requestId ?? req.headers[REQUEST_ID_HEADER] ?? null,
        workspace_id: req.user?.workspace_id ?? (req.headers["x-workspace-slug"] as string) ?? null,
        user_id: req.user?.id ?? null,
        // Never include: auth headers, tokens, API keys, secrets
      };

      // Scrub any leaking sensitive header from the path string
      if (!log.path || String(log.path).includes("token") || String(log.path).includes("secret")) {
        log.path = String(log.path).replace(/=[^&?]*/g, "=[REDACTED]");
      }

      console.log(JSON.stringify(log));
    });

    next();
  }
}
