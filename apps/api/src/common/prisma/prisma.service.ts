import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  [key: string]: any;
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 30000,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    });

    // Log pool errors and let pg-pool handle reconnection automatically
    pool.on('error', (err) => {
      this.logger.warn(`PG pool error: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);
    super({
      adapter,
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to database');
    } catch (err) {
      this.logger.warn(`Prisma connection deferred — DB not ready: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Helper para limpiar la DB en tests — no llamar en producción */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase no está permitido en producción.');
    }
    const tablenames = await this.rawQuery<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public'`
    );
    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await this.$executeRawUnsafe(
          `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
        );
      }
    }
  }

  /**
   * Wrapper tipado para $queryRawUnsafe.
   * El index signature [key: string]: any en la clase interfiere con los
   * type params de $queryRawUnsafe. Este wrapper preserva el genérico.
   */
  async rawQuery<T = any>(query: string, ...params: any[]): Promise<T> {
    return this.$queryRawUnsafe(query, ...params) as unknown as T;
  }
}
