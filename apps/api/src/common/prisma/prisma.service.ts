import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  [key: string]: any;
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isProduction = process.env.NODE_ENV === "production";

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 15,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 30000,
      application_name: `pymeshub-api-${process.pid}`,
      // SECURITY (HIGH-09): Enforce SSL certificate validation in production.
      // rejectUnauthorized: false would allow MITM attacks by accepting any cert.
      ssl: isProduction
        ? { rejectUnauthorized: true }
        : false,
    });

    // Log pool errors and let pg-pool handle reconnection automatically
    pool.on("error", (err) => {
      this.logger.warn(`PG pool error: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);
    super({
      adapter,
      log: ["error", "warn"],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Prisma connected to database");
    } catch (err) {
      this.logger.warn(`Prisma connection deferred — DB not ready: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // ── RLS Context Helpers ─────────────────────────────────────────────────────
  //
  // PymesHub uses Postgres Row-Level Security (RLS) on all workspace-scoped
  // tables. Each policy checks `app.workspace_id` session variable against the
  // row's workspace_id column.
  //
  // IMPORTANT: Call `setWorkspaceContext(workspaceId)` before any query that
  // reads or writes workspace-scoped tables. The setting is transaction-local
  // (third arg = true), so it resets automatically after the transaction ends.
  //
  // Pattern for services:
  //
  //   async findAll(workspaceId: string) {
  //     await this.prisma.setWorkspaceContext(workspaceId);
  //     return this.prisma.someModel.findMany({ where: { workspace_id: workspaceId } });
  //   }
  //
  // For operations that span multiple queries (e.g. inside $transaction), call
  // setWorkspaceContext once at the start of the transaction block.
  //
  // Platform admin operations (migrations, platform-level queries) run as the
  // Postgres superuser which bypasses RLS by default — no context needed.

  /**
   * Sets the Postgres session variable `app.workspace_id` to the given value.
   * This activates the RLS workspace_isolation policy for the current
   * transaction/session. The setting is transaction-local (resets after commit).
   *
   * Must be called before any query on workspace-scoped tables.
   */
  async setWorkspaceContext(workspaceId: string): Promise<void> {
    // Validate input: only allow cuid-like strings (alphanumeric, no SQL special chars)
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(workspaceId)) {
      throw new Error(`Invalid workspaceId format: ${workspaceId}`);
    }
    // Use parameterized set_config to prevent any injection risk
    await this.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
  }

  /**
   * Clears the workspace context by setting `app.workspace_id` to an empty
   * string. With the NULLIF guard in RLS policies, an empty string causes all
   * rows to be hidden — a safe default.
   *
   * Call this after operations that should not carry workspace context forward,
   * or in finally blocks for belt-and-suspenders safety.
   */
  async clearWorkspaceContext(): Promise<void> {
    await this.$executeRaw`SELECT set_config('app.workspace_id', '', true)`;
  }

  /**
   * Executes a callback with workspace RLS context set, clearing it afterwards.
   * Useful for one-off scoped operations outside of a transaction.
   *
   * Example:
   *   const result = await this.prisma.withWorkspaceContext(workspaceId, () =>
   *     this.prisma.conversation.findMany({ where: { workspace_id: workspaceId } })
   *   );
   */
  async withWorkspaceContext<T>(
    workspaceId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    await this.setWorkspaceContext(workspaceId);
    try {
      return await fn();
    } finally {
      await this.clearWorkspaceContext();
    }
  }

  /** Helper para limpiar la DB en tests — no llamar en producción */
  async cleanDatabase() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("cleanDatabase no está permitido en producción.");
    }
    const tablenames = await this.rawQuery<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public'`,
    );
    for (const { tablename } of tablenames) {
      if (tablename !== "_prisma_migrations") {
        await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
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
