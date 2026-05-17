import './common/telemetry/tracing'; // ← PRIMERO
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/telemetry/api-exception.filter';
import { PrismaExceptionFilter } from './common/prisma/prisma-exception.filter';
import { ErrorReportsService } from './error-reports/error-reports.service';
import { PrismaService } from './common/prisma/prisma.service';
import { AiTriageService } from './ai/ai-triage.service';

const logger = new Logger('Bootstrap');

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — process will exit', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ SECURITY: Add Helmet.js for HTTP security headers
  app.use(helmet({
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
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

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
    process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ??
    (process.env.NODE_ENV === 'production'
      ? ['https://pymeshub.lat', 'https://www.PymesHub.lat']
      : [
          'http://localhost:5000',
          'http://127.0.0.1:5000',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'tauri://localhost',
        ]);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-slug'],
    maxAge: 3600,
  });

  let aiTriage: AiTriageService | null = null;
  try {
    aiTriage = app.get(AiTriageService);
  } catch {
    // AiTriageService is optional — may not be registered
  }
  app.useGlobalFilters(new ApiExceptionFilter(app.get(ErrorReportsService), app.get(PrismaService), aiTriage as any));
  app.useGlobalFilters(new PrismaExceptionFilter());
  const port = process.env.PORT ?? 4000;
  const host = process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';
  await app.listen(port, host);
  logger.log(`API ready — listening on http://127.0.0.1:${port}/api`);
}
bootstrap();
