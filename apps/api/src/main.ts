import './common/telemetry/tracing'; // ← PRIMERO
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/telemetry/api-exception.filter';
import { ErrorReportsService } from './error-reports/error-reports.service';

// Suppress ioredis ECONNREFUSED when Redis is not available (dev / no Redis env)
let redisWarned = false;
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'ECONNREFUSED' && (err?.port === 6379 || err?.address === '127.0.0.1' || err?.address === '::1')) {
    if (!redisWarned) {
      console.warn('[Redis] Not available locally — background jobs disabled');
      redisWarned = true;
    }
    return;
  }
  console.error('Uncaught exception:', err);
  process.exit(1);
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
  const corsOrigins =
    process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ??
    (process.env.NODE_ENV === 'production'
      ? ['https://pymeshub.lat', 'https://www.pymeshub.lat']
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

  app.useGlobalFilters(new ApiExceptionFilter(app.get(ErrorReportsService)));
  const port = process.env.PORT ?? 4000;
  const host = process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';
  await app.listen(port, host);
  console.log(`🚀 API corriendo en http://127.0.0.1:${port}/api`);
}
bootstrap();
