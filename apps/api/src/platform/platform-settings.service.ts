/**
 * PlatformSettingsService
 *
 * Manages a singleton row in `platform_settings` that stores platform-level
 * configuration (MiMo API key, admin phones, GitHub token, etc.).
 * Sensitive values are encrypted with CryptoService before being stored.
 *
 * Usage:
 *   get()          → public view (keys masked with "••••")
 *   getDecrypted() → internal use (plain-text values)
 *   update(dto)    → merge-patch, encrypts sensitive fields
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";

export interface PlatformSettingsPublic {
  mimo_api_key_set: boolean;
  admin_phones: string | null;
  admin_ai_model: string | null;
  github_token_set: boolean;
  github_repo_owner: string | null;
  github_repo_name: string | null;
  updated_at: Date | null;
}

export interface PlatformSettingsDecrypted {
  mimo_api_key: string | null;
  admin_phones: string | null;
  admin_ai_model: string | null;
  github_token: string | null;
  github_repo_owner: string | null;
  github_repo_name: string | null;
}

export interface UpdatePlatformSettingsDto {
  /** New MiMo API key — leave undefined/empty to keep existing */
  mimo_api_key?: string;
  admin_phones?: string;
  admin_ai_model?: string;
  /** New GitHub PAT — leave undefined/empty to keep existing */
  github_token?: string;
  github_repo_owner?: string;
  github_repo_name?: string;
}

const SINGLETON_ID = "singleton";

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** Return public (masked) view of platform settings */
  async get(): Promise<PlatformSettingsPublic> {
    const row = await this.getOrCreate();
    return {
      mimo_api_key_set: !!row.mimo_api_key_enc,
      admin_phones: row.admin_phones ?? null,
      admin_ai_model: row.admin_ai_model ?? null,
      github_token_set: !!row.github_token_enc,
      github_repo_owner: row.github_repo_owner ?? null,
      github_repo_name: row.github_repo_name ?? null,
      updated_at: row.updated_at ?? null,
    };
  }

  /** Return decrypted values — INTERNAL USE ONLY, never expose to frontend */
  async getDecrypted(): Promise<PlatformSettingsDecrypted> {
    const row = await this.getOrCreate();
    return {
      mimo_api_key:     this.decryptOrNull(row.mimo_api_key_enc),
      admin_phones:     row.admin_phones ?? null,
      admin_ai_model:   row.admin_ai_model ?? null,
      github_token:     this.decryptOrNull(row.github_token_enc),
      github_repo_owner: row.github_repo_owner ?? null,
      github_repo_name:  row.github_repo_name ?? null,
    };
  }

  /** Merge-update platform settings */
  async update(dto: UpdatePlatformSettingsDto, updatedById?: string): Promise<PlatformSettingsPublic> {
    const current = await this.getOrCreate();

    const data: Record<string, unknown> = { updated_by_id: updatedById ?? null };

    // Sensitive fields — only update if a new non-empty value is provided
    if (dto.mimo_api_key?.trim()) {
      data.mimo_api_key_enc = this.crypto.encrypt(dto.mimo_api_key.trim());
    }
    if (dto.github_token?.trim()) {
      data.github_token_enc = this.crypto.encrypt(dto.github_token.trim());
    }

    // Plain fields — always update when provided
    if (dto.admin_phones !== undefined) data.admin_phones = dto.admin_phones || null;
    if (dto.admin_ai_model !== undefined) data.admin_ai_model = dto.admin_ai_model || null;
    if (dto.github_repo_owner !== undefined) data.github_repo_owner = dto.github_repo_owner || null;
    if (dto.github_repo_name !== undefined) data.github_repo_name = dto.github_repo_name || null;

    // Use upsert so this works even if the row was never created
    await (this.prisma as any).platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });

    this.logger.log(`[platform-settings] updated by ${updatedById ?? "system"}`);
    return this.get();
  }

  /** Clear a specific sensitive field (e.g. "reset MiMo key") */
  async clearField(field: "mimo_api_key" | "github_token"): Promise<void> {
    const colMap = { mimo_api_key: "mimo_api_key_enc", github_token: "github_token_enc" } as const;
    await (this.prisma as any).platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: { [colMap[field]]: null },
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getOrCreate() {
    const existing = await (this.prisma as any).platformSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (existing) return existing;

    // Create the singleton row on first access
    return (this.prisma as any).platformSettings.create({
      data: { id: SINGLETON_ID },
    });
  }

  private decryptOrNull(enc: string | null | undefined): string | null {
    if (!enc) return null;
    try {
      return this.crypto.decrypt(enc);
    } catch {
      this.logger.warn("[platform-settings] failed to decrypt value — key mismatch?");
      return null;
    }
  }
}
