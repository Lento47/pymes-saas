import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const CURRENT_VERSION = process.env.ENCRYPTION_KEY_VERSION ?? "1";

/**
 * AES-256-GCM encryption with key rotation support.
 *
 * Encrypted format: `v{version}:{iv_hex}:{tag_hex}:{data_hex}`
 *
 * Key selection:
 *   - Version 1: ENCRYPTION_KEY (legacy default)
 *   - Version N: ENCRYPTION_KEY_vN environment variable
 *
 * To rotate keys:
 *   1. Generate a new key and set ENCRYPTION_KEY_v2=<new_key>
 *   2. Set ENCRYPTION_KEY_VERSION=2
 *   3. New writes use v2; old v1 data is still readable
 *   4. Run a background migration to re-encrypt v1 fields with v2
 */
@Injectable()
export class CryptoService {
  private getKey(version: string): Buffer {
    let raw: string | undefined;
    if (version === "1") {
      // Backwards-compatible: ENCRYPTION_KEY is the v1 key
      raw = process.env.ENCRYPTION_KEY_v1 ?? process.env.ENCRYPTION_KEY;
    } else {
      raw = process.env[`ENCRYPTION_KEY_v${version}`];
    }
    if (!raw) {
      throw new Error(
        `Encryption key for version ${version} is not set. ` +
          `Ensure ENCRYPTION_KEY_v${version} (or ENCRYPTION_KEY for v1) is configured.`,
      );
    }
    return Buffer.from(raw.padEnd(KEY_LENGTH).slice(0, KEY_LENGTH));
  }

  encrypt(text: string): string {
    const version = CURRENT_VERSION;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, this.getKey(version), iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v${version}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  decrypt(encryptedText: string): string {
    // Support both versioned format (v1:iv:tag:data) and legacy (iv:tag:data)
    const parts = encryptedText.split(":");
    let version: string;
    let ivHex: string;
    let tagHex: string;
    let dataHex: string;

    if (parts[0].startsWith("v") && parts.length === 4) {
      version = parts[0].slice(1);
      [, ivHex, tagHex, dataHex] = parts;
    } else if (parts.length === 3) {
      // Legacy format without version prefix — assume v1
      version = "1";
      [ivHex, tagHex, dataHex] = parts;
    } else {
      throw new Error("Invalid encrypted text format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(version), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  }

  /**
   * Returns true if the value is encrypted with an older key version than
   * the current one. Used by key-rotation scripts to identify fields that
   * need re-encryption.
   */
  needsReEncryption(encryptedText: string): boolean {
    if (!encryptedText.startsWith("v")) return true; // legacy format
    const version = encryptedText.split(":")[0].slice(1);
    return version !== CURRENT_VERSION;
  }
}
