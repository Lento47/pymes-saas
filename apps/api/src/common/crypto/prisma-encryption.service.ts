import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "./crypto.service";

/**
 * Encrypted field registry.
 * Format: { ModelName: Set<"field_name"> }
 *
 * Fields listed here are transparently encrypted on write and decrypted on
 * read via the Prisma $use() middleware registered in onModuleInit().
 *
 * Adding a new field here is safe for new records. Existing plaintext records
 * will NOT be decrypted automatically — run a migration script first.
 */
const ENCRYPTED_FIELDS: Record<string, Set<string>> = {
  // Channel stores provider tokens (WhatsApp access tokens, Telegram bot tokens)
  // in config_json. Encrypt at the DB level so a DB dump reveals no credentials.
  // NOTE: config_json is JSON; we serialize to string before encrypting.
  Channel: new Set(["config_json"]),
};

function isEncrypted(value: string): boolean {
  return typeof value === "string" && (value.startsWith("v") || /^[0-9a-f]{32}:/.test(value));
}

@Injectable()
export class PrismaEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(PrismaEncryptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  onModuleInit() {
    this.prisma.$use(async (params, next) => {
      // ── Encrypt on write ───────────────────────────────────────────────────
      if (params.model && params.action in { create: 1, update: 1, upsert: 1, createMany: 1, updateMany: 1 }) {
        const fields = ENCRYPTED_FIELDS[params.model];
        if (fields) {
          this.encryptParams(params, fields);
        }
      }

      const result = await next(params);

      // ── Decrypt on read ────────────────────────────────────────────────────
      if (params.model) {
        const fields = ENCRYPTED_FIELDS[params.model];
        if (fields) {
          this.decryptResult(result, fields, params.model);
        }
      }

      return result;
    });

    this.logger.log(
      `Prisma encryption middleware active for: ${Object.keys(ENCRYPTED_FIELDS).join(", ")}`,
    );
  }

  private encryptParams(params: any, fields: Set<string>): void {
    const data = params.args?.data;
    if (!data || typeof data !== "object") return;

    for (const field of fields) {
      if (field in data && data[field] !== null && data[field] !== undefined) {
        const raw = typeof data[field] === "string"
          ? data[field]
          : JSON.stringify(data[field]);
        if (!isEncrypted(raw)) {
          try {
            data[field] = this.crypto.encrypt(raw);
          } catch (err) {
            this.logger.warn(
              `Failed to encrypt ${params.model}.${field}: ${(err as Error).message}`,
            );
          }
        }
      }
    }
  }

  private decryptResult(result: any, fields: Set<string>, model: string): void {
    if (!result) return;

    const decrypt = (record: any) => {
      if (!record || typeof record !== "object") return;
      for (const field of fields) {
        if (typeof record[field] === "string" && isEncrypted(record[field])) {
          try {
            const decrypted = this.crypto.decrypt(record[field]);
            // If the original value was JSON, parse it back
            try {
              record[field] = JSON.parse(decrypted);
            } catch {
              record[field] = decrypted;
            }
          } catch (err) {
            this.logger.warn(
              `Failed to decrypt ${model}.${field} — returning as-is: ${(err as Error).message}`,
            );
          }
        }
      }
    };

    if (Array.isArray(result)) {
      result.forEach(decrypt);
    } else {
      decrypt(result);
    }
  }
}
