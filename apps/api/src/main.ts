import "./common/telemetry/tracing"; // ← PRIMERO
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/telemetry/api-exception.filter";
import { PrismaExceptionFilter } from "./common/prisma/prisma-exception.filter";
import { ErrorReportsService } from "./error-reports/error-reports.service";
import { PrismaService } from "./common/prisma/prisma.service";
import { AiTriageService } from "./ai/ai-triage.service";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const logger = new Logger("Bootstrap");

// ── Startup env validation ─────────────────────────────────────────────────
// Fail fast before any network binding if critical config is missing.
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
] as const;

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(", ")}`);
    logger.error("Server will not start until all required env vars are set.");
    process.exit(1);
  }
}
// ──────────────────────────────────────────────────────────────────────────

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION — process will exit", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("UNHANDLED REJECTION", reason);
});

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule, { rawBody: true });

  // ✅ SECURITY: Add Helmet.js for HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  // SECURITY: cookie-parser required for httpOnly refresh token cookie
  app.use(cookieParser());

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ✅ SECURITY: Strict CORS configuration with origin validation
  // ──────────────────────────────────────────────────────────────────────
  // IMPORTANTE — ORIGENES CORS:
  //   PROD  → SOLO `PymesHub.lat` Y `www.PymesHub.lat`. SI SE AGREGA UN
  //           DOMINIO NUEVO (ej. `app.pymeshub.lat`), AGREGARLO ACA O EN
  //           `CORS_ORIGIN` EN RAILWAY (FORMATO: COMA-SEPARADO).
  //   DEV   → LOCALHOST EN VARIOS PUERTOS + `tauri://localhost` (DESKTOP).
  //           ESTAS URLS NUNCA DEBEN ACTIVARSE EN PROD — `NODE_ENV` LO GUARDA.
  // ──────────────────────────────────────────────────────────────────────
  const corsOrigins =
    process.env.CORS_ORIGIN?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ??
    (process.env.NODE_ENV === "production"
      ? ["https://pymeshub.lat", "https://www.PymesHub.lat"]
      : [
          "http://localhost:5000",
          "http://127.0.0.1:5000",
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "tauri://localhost",
        ]);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-workspace-slug"],
    maxAge: 3600,
  });

  let aiTriage: AiTriageService | null = null;
  try {
    aiTriage = app.get(AiTriageService);
  } catch {
    // AiTriageService is optional — may not be registered
  }
  app.useGlobalFilters(
    new ApiExceptionFilter(app.get(ErrorReportsService), app.get(PrismaService), aiTriage as any),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  // OpenAPI docs — enabled in dev or when SWAGGER_ENABLED=true
  if (process.env.NODE_ENV !== "production" || process.env.SWAGGER_ENABLED === "true") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("PymesHub API")
      .setDescription("API multi-tenant para PymesHub — CRM + Inbox + Facturación + IA para PYMEs")
      .setVersion("1.0")
      .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "JWT")
      .addGlobalParameters({
        in: "header",
        required: false,
        name: "x-workspace-slug",
        schema: { type: "string" },
        description: "Workspace slug (used by API tokens)",
      })
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger docs at http://127.0.0.1:${process.env.PORT ?? 4000}/api/docs`);
  }

  const port = process.env.PORT ?? 4000;
  const host = process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0";
  await app.listen(port, host);
  logger.log(`API ready — listening on http://127.0.0.1:${port}/api`);
}
bootstrap();
