import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly retainCount: number;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.backupDir = config.get<string>("BACKUP_DIR") ?? path.join(process.cwd(), "backups");
    this.retainCount = Number(config.get<string>("BACKUP_RETAIN_COUNT") ?? "7");
    this.enabled = config.get<string>("BACKUP_ENABLED") !== "false";
  }

  // Daily at 02:00
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledBackup() {
    if (!this.enabled) return;
    await this.runBackup();
  }

  async runBackup(): Promise<{ success: boolean; filePath?: string; sizeMb?: number; error?: string }> {
    const databaseUrl = this.config.get<string>("DATABASE_URL");
    if (!databaseUrl) {
      this.logger.error("DATABASE_URL not set — backup skipped");
      return { success: false, error: "DATABASE_URL not configured" };
    }

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const gzFile = path.join(this.backupDir, `backup-${timestamp}.sql.gz`);

    let url: URL;
    try {
      url = new URL(databaseUrl);
    } catch {
      return { success: false, error: "Invalid DATABASE_URL format" };
    }

    const host = url.hostname;
    const port = url.port || "5432";
    const dbName = url.pathname.slice(1);
    const username = url.username;
    const password = url.password;

    this.logger.log(`Starting backup → ${gzFile}`);

    return new Promise((resolve) => {
      const env = { ...process.env, PGPASSWORD: password } as Record<string, string>;

      const child = spawn(
        "pg_dump",
        ["-h", host, "-p", port, "-U", username, "-F", "plain", "--no-password", dbName],
        { env, stdio: ["ignore", "pipe", "pipe"] },
      );

      const gzip = zlib.createGzip({ level: 6 });
      const output = fs.createWriteStream(gzFile);
      const stderrChunks: Buffer[] = [];

      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
      child.stdout.pipe(gzip).pipe(output);

      child.on("close", (code) => {
        output.close(() => {
          if (code !== 0) {
            const errMsg = Buffer.concat(stderrChunks).toString().slice(0, 300);
            this.logger.error(`pg_dump failed (exit ${code}): ${errMsg}`);
            if (fs.existsSync(gzFile)) fs.unlinkSync(gzFile);
            resolve({ success: false, error: `pg_dump exit ${code}: ${errMsg}` });
            return;
          }

          try {
            const stats = fs.statSync(gzFile);
            const sizeMb = parseFloat((stats.size / 1024 / 1024).toFixed(2));
            this.logger.log(`Backup complete: ${gzFile} (${sizeMb} MB)`);
            this.pruneOldBackups().catch(() => {});
            resolve({ success: true, filePath: gzFile, sizeMb });
          } catch (err) {
            resolve({ success: false, error: (err as Error).message });
          }
        });
      });

      child.on("error", (err) => {
        this.logger.error(`Spawn error: ${err.message}`);
        if (fs.existsSync(gzFile)) fs.unlinkSync(gzFile);
        resolve({ success: false, error: err.message });
      });
    });
  }

  private async pruneOldBackups(): Promise<void> {
    try {
      const files = fs
        .readdirSync(this.backupDir)
        .filter((f) => f.startsWith("backup-") && f.endsWith(".sql.gz"))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(this.backupDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

      for (const file of files.slice(this.retainCount)) {
        fs.unlinkSync(path.join(this.backupDir, file.name));
        this.logger.log(`Pruned: ${file.name}`);
      }
    } catch (err) {
      this.logger.warn(`Prune failed: ${(err as Error).message}`);
    }
  }

  listBackups(): { name: string; sizeMb: number; createdAt: Date }[] {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs
      .readdirSync(this.backupDir)
      .filter((f) => f.startsWith("backup-") && f.endsWith(".sql.gz"))
      .map((f) => {
        const stats = fs.statSync(path.join(this.backupDir, f));
        return {
          name: f,
          sizeMb: parseFloat((stats.size / 1024 / 1024).toFixed(2)),
          createdAt: stats.mtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
