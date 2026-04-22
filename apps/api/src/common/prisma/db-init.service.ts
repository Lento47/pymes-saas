import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from './prisma.service';

@Injectable()
export class DbInitService implements OnModuleInit {
  private readonly logger = new Logger(DbInitService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const dbUrl = process.env.DATABASE_URL ?? '';
    if (!dbUrl.startsWith('file:') && !dbUrl.endsWith('.db')) return;
    await this.ensureSchema();
  }

  private async ensureSchema() {
    try {
      const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='workspaces'
      `;
      if (result[0] && Number(result[0].count) > 0) {
        this.logger.log('SQLite schema already initialized');
        return;
      }
    } catch {
      // DB might not be accessible yet, continue to init
    }

    const sqlPath = this.findSchemaSql();
    if (!sqlPath) {
      this.logger.warn('schema.sql not found — skipping SQLite init. Run prisma migrate deploy manually.');
      return;
    }

    this.logger.log(`Initializing SQLite schema from ${sqlPath}`);
    try {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      const statements = sql
        .split(/;\s*\n/)
        .map((s) => s.replace(/--[^\n]*/g, '').trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        try {
          await this.prisma.$executeRawUnsafe(stmt);
        } catch (e: any) {
          // Ignore "already exists" errors for idempotency
          if (!e?.message?.includes('already exists')) {
            this.logger.warn(`Schema stmt warning: ${e?.message}`);
          }
        }
      }
      this.logger.log('SQLite schema initialized successfully');

      // Seed enterprise plan for the default workspace if it exists
      await this.ensureEnterprisePlan();
    } catch (err: any) {
      this.logger.error('Failed to initialize SQLite schema', err?.message);
    }
  }

  private async ensureEnterprisePlan() {
    try {
      const workspaces = await this.prisma.workspace.findMany({ take: 1 });
      for (const ws of workspaces) {
        if (ws.plan !== 'ENTERPRISE') {
          await this.prisma.workspace.update({
            where: { id: ws.id },
            data: { plan: 'ENTERPRISE' },
          });
          this.logger.log(`Workspace ${ws.slug} upgraded to ENTERPRISE plan`);
        }
      }
    } catch {
      // Not critical
    }
  }

  private findSchemaSql(): string | null {
    const candidates: (string | null)[] = [
      // 1. Next to the compiled main.js (in dist/)
      path.join(__dirname, 'schema.sql'),

      // 2. In the root dist directory
      path.join(__dirname, '..', '..', '..', 'schema.sql'),

      // 3. In Tauri resource directory (MSI installation)
      process.env.TAURI_RESOURCE_DIR
        ? path.join(
            process.env.TAURI_RESOURCE_DIR,
            'enterprise-runtime',
            'a',
            'schema.sql'
          )
        : null,

      // 4. In application data directory (Windows)
      process.env.APPDATA
        ? path.join(process.env.APPDATA, 'Pymeshub', 'schema.sql')
        : null,

      // 5. In PROGRAMDATA (Windows system-wide)
      process.env.PROGRAMDATA
        ? path.join(
            process.env.PROGRAMDATA,
            'Pymeshub',
            'data',
            'schema.sql'
          )
        : null,

      // 6. Next to pkg executable (only if execPath is a valid .exe)
      process.execPath && process.execPath.endsWith('.exe')
        ? path.join(path.dirname(process.execPath), 'schema.sql')
        : null,

      // 7. Current working directory (last resort for dev)
      path.join(process.cwd(), 'schema.sql'),
      path.join(process.cwd(), 'dist', 'schema.sql'),
    ].filter((p): p is string => Boolean(p) && typeof p === 'string');

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          this.logger.log(`Found schema.sql at: ${p}`);
          return p;
        }
      } catch {
        // Ignore paths that cause errors (e.g., invalid characters)
        continue;
      }
    }

    this.logger.error(
      `schema.sql not found in any expected location. Checked: ${candidates.join(', ')}`
    );
    return null;
  }
}
