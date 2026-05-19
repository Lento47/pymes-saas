import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

const startedAt = new Date();

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  get() {
    return this.live();
  }

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'pymes-api',
      uptime_seconds: Math.floor(process.uptime()),
      started_at: startedAt.toISOString(),
      timestamp: new Date().toISOString(),
      version: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
    };
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, { status: 'ok' | 'error'; detail?: string }> = {};

    await this.checkDatabase(checks);
    this.checkRequiredConfig(checks);
    this.checkStorageConfig(checks);
    this.checkRedisConfig(checks);

    const ready = Object.values(checks).every((check) => check.status === 'ok');
    const response = {
      status: ready ? 'ok' : 'error',
      service: 'pymes-api',
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
    };

    if (!ready) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  private async checkDatabase(checks: Record<string, { status: 'ok' | 'error'; detail?: string }>) {
    try {
      await this.prisma.rawQuery<Array<{ ok: number }>>('SELECT 1 AS ok');
      checks.database = { status: 'ok' };
    } catch (error) {
      checks.database = {
        status: 'error',
        detail: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  private checkRequiredConfig(checks: Record<string, { status: 'ok' | 'error'; detail?: string }>) {
    const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((key) => !this.config.get<string>(key));
    checks.config = missing.length === 0
      ? { status: 'ok' }
      : { status: 'error', detail: `Missing required env: ${missing.join(', ')}` };
  }

  private checkStorageConfig(checks: Record<string, { status: 'ok' | 'error'; detail?: string }>) {
    const driver = this.config.get<string>('STORAGE_DRIVER') ?? 'local';

    if (driver === 's3' || driver === 'minio') {
      const missing = ['STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'].filter(
        (key) => !this.config.get<string>(key),
      );
      checks.storage = missing.length === 0
        ? { status: 'ok', detail: driver }
        : { status: 'error', detail: `Missing storage env: ${missing.join(', ')}` };
      return;
    }

    checks.storage = { status: 'ok', detail: driver };
  }

  private checkRedisConfig(checks: Record<string, { status: 'ok' | 'error'; detail?: string }>) {
    const hasRedis = !!(
      this.config.get<string>('REDIS_URL') ||
      this.config.get<string>('REDIS_HOST') ||
      this.config.get<string>('UPSTASH_REDIS_REST_URL')
    );

    checks.redis = hasRedis
      ? { status: 'ok' }
      : { status: 'error', detail: 'Missing REDIS_URL/REDIS_HOST. Queueing, throttling, and workers may fail.' };
  }
}
