import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "./crypto.service";

/**
 * Encrypted field registry.
 * Format: { ModelName: Set<"field_name"> }
 *
 * Fields listed here are transparently encrypted on write and decrypted on
 * read via a Prisma Client Extension registered in onModuleInit().
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
    const encryptedFields = ENCRYPTED_FIELDS;
    const cryptoSvc = this.crypto;
    const logger = this.logger;

    const extended = this.prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: {
            model: string;
            operation: string;
            args: any;
            query: (args: any) => Promise<any>;
          }) {
            const fields = encryptedFields[model];

            // ── Encrypt on write ─────────────────────────────────────────────
            if (
              fields &&
              operation in { create: 1, update: 1, upsert: 1, createMany: 1, updateMany: 1 }
            ) {
              encryptParams(args, fields, model, logger, cryptoSvc);
            }

            const result = await query(args);

            // ── Decrypt on read ──────────────────────────────────────────────
            if (fields) {
              decryptResult(result, fields, model, logger, cryptoSvc);
            }

            return result;
          },
        },
      },
    });

    // Copy extended client properties onto the original PrismaService instance
    // so that all existing injectors (which hold a reference to this.prisma)
    // automatically get the encrypted/decrypted behavior.
    const extProto = Object.getPrototypeOf(extended);
    for (const key of Object.getOwnPropertyNames(extProto)) {
      if (key === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(extProto, key);
      if (desc) Object.defineProperty(this.prisma, key, desc);
    }
    for (const key of Object.getOwnPropertyNames(extended)) {
      const desc = Object.getOwnPropertyDescriptor(extended, key);
      if (desc) Object.defineProperty(this.prisma, key, desc);
    }

    this.logger.log(
      `Prisma encryption extension active for: ${Object.keys(encryptedFields).join(", ")}`,
    );
  }
}

function encryptParams(
  args: any,
  fields: Set<string>,
  model: string,
  logger: Logger,
  cryptoSvc: CryptoService,
): void {
  // Handle both single-record (data) and bulk (data array) operations
  const items = Array.isArray(args?.data) ? args.data : args?.data ? [args.data] : [];

  for (const data of items) {
    if (!data || typeof data !== "object") continue;
    for (const field of fields) {
      if (field in data && data[field] !== null && data[field] !== undefined) {
        const raw =
          typeof data[field] === "string" ? data[field] : JSON.stringify(data[field]);
        if (!isEncrypted(raw)) {
          try {
            data[field] = cryptoSvc.encrypt(raw);
          } catch (err) {
            logger.warn(
              `Failed to encrypt ${model}.${field}: ${(err as Error).message}`,
            );
          }
        }
      }
    }
  }
}

function decryptResult(
  result: any,
  fields: Set<string>,
  model: string,
  logger: Logger,
  cryptoSvc: CryptoService,
): void {
  if (!result) return;

  const decrypt = (record: any) => {
    if (!record || typeof record !== "object") return;
    for (const field of fields) {
      if (typeof record[field] === "string" && isEncrypted(record[field])) {
        try {
          const decrypted = cryptoSvc.decrypt(record[field]);
          try {
            record[field] = JSON.parse(decrypted);
          } catch {
            record[field] = decrypted;
          }
        } catch (err) {
          logger.warn(
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
