import * as path from 'path';
import * as fs from 'fs';

// When bundled with pkg, set up Prisma engine path before any imports
if ((process as any).pkg) {
  const execDir = path.dirname(process.execPath);
  const enginePath = path.join(execDir, 'libquery_engine-windows.dll.node');
  if (fs.existsSync(enginePath)) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY_PATH = enginePath;
  }
  // Default SQLite DB to user AppData if not set
  if (!process.env.DATABASE_URL) {
    const appData = process.env.APPDATA ?? path.join(process.env.HOME ?? '', '.config');
    const dbDir = path.join(appData, 'PymeHub Enterprise');
    fs.mkdirSync(dbDir, { recursive: true });
    process.env.DATABASE_URL = `file:${path.join(dbDir, 'pymeshub.db')}`;
  }
}

import './common/telemetry/tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/telemetry/api-exception.filter';
import { ErrorReportsService } from './error-reports/error-reports.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  const corsOrigins =
    process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ??
    [
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://tauri.localhost',
      'tauri://localhost',
    ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalFilters(new ApiExceptionFilter(app.get(ErrorReportsService)));
  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://127.0.0.1:${port}/api`);
}
bootstrap();
