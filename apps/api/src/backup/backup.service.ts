import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import * as https from "https";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Retain backups for 30 days in S3 (also purges local copy after upload).
const RETAIN_DAYS = 30;
const BACKUP_S3_PREFIX = "backups/";

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly enabled: boolean;
  private readonly s3?: S3Client;
  private readonly bucket?: string;

  constructor(private readonly config: ConfigService) {
    this.backupDir = config.get<string>("BACKUP_DIR") ?? path.join(process.cwd(), "backups");
    this.enabled = config.get<string>("BACKUP_ENABLED") !== "false";

    const accessKey = config.get<string>("STORAGE_ACCESS_KEY");
    const secretKey = config.get<string>("STORAGE_SECRET_KEY");
    const region = config.get<string>("STORAGE_REGION") ?? "us-east-1";
    const endpoint = config.get<string>("STORAGE_ENDPOINT");
    this.bucket = config.get<string>("STORAGE_BUCKET");

    if (accessKey && secretKey && this.bucket) {
      let resolvedEndpoint = endpoint;
      if (resolvedEndpoint && !/^https?:\/\//i.test(resolvedEndpoint)) {
        resolvedEndpoint = `http://${resolvedEndpoint}`;
      }
      this.s3 = new S3Client({
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        ...(resolvedEndpoint && { endpoint: resolvedEndpoint, forcePathStyle: true }),
      });
    }
  }

  // Daily at 02:30 (offset from data-retention at 02:00)
  @Cron("30 2 * * *")
  async scheduledBackup() {
    if (!this.enabled) return;
    const result = await this.runBackup();
    await this.notifySlack(result);
  }

  async runBackup(): Promise<{
    success: boolean;
    filePath?: string;
    s3Key?: string;
    sizeMb?: number;
    error?: string;
  }> {
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

    const pgResult = await this.runPgDump(host, port, dbName, username, password, gzFile);
    if (!pgResult.success) return pgResult;

    const sizeMb = pgResult.sizeMb!;

    // Upload to S3 if configured
    if (this.s3 && this.bucket) {
      try {
        const s3Key = `${BACKUP_S3_PREFIX}backup-${timestamp}.sql.gz`;
        const fileBuffer = fs.readFileSync(gzFile);
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: "application/gzip",
            Metadata: { "backup-date": timestamp, "size-mb": String(sizeMb) },
          }),
        );
        this.logger.log(`Backup uploaded to S3: s3://${this.bucket}/${s3Key}`);

        // Remove local copy after successful upload to save disk
        fs.unlinkSync(gzFile);

        // Prune old S3 backups (>30 days)
        await this.pruneS3Backups().catch((e) =>
          this.logger.warn(`S3 prune failed: ${(e as Error).message}`),
        );

        return { success: true, s3Key, sizeMb };
      } catch (err) {
        this.logger.error(`S3 upload failed: ${(err as Error).message}`);
        // Keep local copy if S3 upload fails
        return { success: true, filePath: gzFile, sizeMb, error: `S3 upload failed: ${(err as Error).message}` };
      }
    }

    // No S3 — keep local, prune by count (last 30 files)
    await this.pruneLocalBackups(30);
    return { success: true, filePath: gzFile, sizeMb };
  }

  listBackups(): { name: string; sizeMb: number; createdAt: Date }[] {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs
      .readdirSync(this.backupDir)
      .filter((f) => f.startsWith("backup-") && f.endsWith(".sql.gz"))
      .map((f) => {
        const stats = fs.statSync(path.join(this.backupDir, f));
        return { name: f, sizeMb: parseFloat((stats.size / 1024 / 1024).toFixed(2)), createdAt: stats.mtime };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private runPgDump(
    host: string,
    port: string,
    dbName: string,
    username: string,
    password: string,
    gzFile: string,
  ): Promise<{ success: boolean; filePath?: string; sizeMb?: number; error?: string }> {
    return new Promise((resolve) => {
      const env = { ...process.env, PGPASSWORD: password } as Record<string, string>;

      const child = spawn(
        "pg_dump",
        ["-h", host, "-p", port, "-U", username, "-F", "plain", "--no-password", dbName],
        { env, stdio: ["ignore", "pipe", "pipe"] },
      );

      const gz = zlib.createGzip({ level: 6 });
      const output = fs.createWriteStream(gzFile);
      const stderrChunks: Buffer[] = [];

      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
      child.stdout.pipe(gz).pipe(output);

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
            this.logger.log(`pg_dump done: ${gzFile} (${sizeMb} MB)`);
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

  private async pruneS3Backups(): Promise<void> {
    if (!this.s3 || !this.bucket) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETAIN_DAYS);

    const list = await this.s3.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: BACKUP_S3_PREFIX }),
    );

    const toDelete = (list.Contents ?? []).filter(
      (obj) => obj.LastModified && obj.LastModified < cutoff && obj.Key,
    );

    for (const obj of toDelete) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: obj.Key! }));
      this.logger.log(`Pruned S3 backup: ${obj.Key}`);
    }
  }

  private async pruneLocalBackups(keepCount: number): Promise<void> {
    try {
      const files = fs
        .readdirSync(this.backupDir)
        .filter((f) => f.startsWith("backup-") && f.endsWith(".sql.gz"))
        .map((f) => ({ name: f, time: fs.statSync(path.join(this.backupDir, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

      for (const file of files.slice(keepCount)) {
        fs.unlinkSync(path.join(this.backupDir, file.name));
        this.logger.log(`Pruned local backup: ${file.name}`);
      }
    } catch (err) {
      this.logger.warn(`Local prune failed: ${(err as Error).message}`);
    }
  }

  private notifySlack(result: { success: boolean; s3Key?: string; filePath?: string; sizeMb?: number; error?: string }): void {
    const webhookUrl = this.config.get<string>("SLACK_WEBHOOK_URL");
    if (!webhookUrl) return;

    const icon = result.success ? "✅" : "❌";
    const location = result.s3Key ? `S3: ${result.s3Key}` : result.filePath ?? "local";
    const detail = result.success
      ? `${result.sizeMb} MB → ${location}`
      : `Error: ${result.error}`;

    const payload = JSON.stringify({
      text: `${icon} *PymesHub DB Backup* — ${result.success ? "OK" : "FAILED"}\n${detail}`,
    });

    try {
      const parsed = new URL(webhookUrl);
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      });
      req.on("error", () => undefined);
      req.write(payload);
      req.end();
    } catch {
      // Never let notification failure break backup flow
    }
  }
}
