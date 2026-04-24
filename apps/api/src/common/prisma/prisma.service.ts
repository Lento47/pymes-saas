import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  [key: string]: any;

  constructor() {
    super({
      // SECURITY: Only log errors to prevent sensitive data exposure in logs
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Helper para limpiar la DB en tests — no llamar en producción */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase no está permitido en producción.');
    }

    // Whitelist of allowed tables for safety
    const ALLOWED_TABLES = new Set([
      'User', 'Workspace', 'Contact', 'Conversation', 'Message',
      'Task', 'Document', 'Invitation', 'Workspace_Invite_Config',
      'events_queue', 'payments', 'subscriptions',
    ]);

    const tablenames = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations' && ALLOWED_TABLES.has(tablename)) {
        await this.$executeRawUnsafe(
          `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
        );
      }
    }
  }
}
