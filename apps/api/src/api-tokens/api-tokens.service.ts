import { Injectable, Logger, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { parseJsonValue } from "../common/prisma/json";
import * as crypto from "crypto";

export interface ApiToken {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

@Injectable()
export class ApiTokensService {
  private readonly logger = new Logger(ApiTokensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly config: ConfigService,
  ) {}

  async getTokens(workspaceId: string): Promise<ApiToken[]> {
    const { tokens } = await this.loadSettings(workspaceId);
    return tokens;
  }

  async createToken(
    workspaceId: string,
    name: string,
  ): Promise<{ token: string; record: ApiToken }> {
    // Enforce ENTERPRISE plan
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true, settings_json: true },
    });

    const allowedPlans = ["ENTERPRISE", "BUSINESS_PLUS"];
    if (!allowedPlans.includes(ws?.plan ?? "")) {
      throw new ForbiddenException("API tokens require Enterprise or Business+ plan.");
    }

    const settings = parseJsonValue<Record<string, any>>(ws.settings_json, {});
    const tokens: ApiToken[] = settings.api_tokens || [];
    const secrets: Record<string, string> = settings.api_token_secrets || {};

    const id = crypto.randomUUID();
    const rawToken = `pym_${crypto.randomBytes(24).toString("hex")}`;
    const encrypted = this.cryptoService.encrypt(rawToken);
    const record: ApiToken = {
      id,
      name,
      created_at: new Date().toISOString(),
      last_used_at: null,
    };

    tokens.push(record);
    secrets[id] = encrypted;

    await this.saveSettings(workspaceId, {
      ...settings,
      api_tokens: tokens,
      api_token_secrets: secrets,
    });

    this.logger.log(`API token "${name}" created for workspace ${workspaceId}`);

    return { token: rawToken, record };
  }

  async revokeToken(workspaceId: string, tokenId: string): Promise<void> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const settings = parseJsonValue<Record<string, any>>(ws?.settings_json, {});
    const tokens: ApiToken[] = (settings.api_tokens || []).filter(
      (t: ApiToken) => t.id !== tokenId,
    );
    const secrets: Record<string, string> = settings.api_token_secrets || {};
    delete secrets[tokenId];

    await this.saveSettings(workspaceId, {
      ...settings,
      api_tokens: tokens,
      api_token_secrets: secrets,
    });
  }

  async validateToken(rawToken: string): Promise<{ workspaceId: string } | null> {
    if (!rawToken.startsWith("pym_")) return null;

    // Find the workspace that has this token
    const allWorkspaces = await this.prisma.workspace.findMany({
      where: { plan: { in: ["ENTERPRISE", "BUSINESS_PLUS"] } },
      select: { id: true, settings_json: true },
    });

    for (const ws of allWorkspaces) {
      const settings = parseJsonValue<Record<string, any>>(ws.settings_json, {});
      const secrets: Record<string, string> = settings.api_token_secrets || {};
      for (const [id, encrypted] of Object.entries(secrets)) {
        try {
          const decrypted = this.cryptoService.decrypt(encrypted);
          if (decrypted === rawToken) {
            // Update last_used_at
            const tokens: ApiToken[] = settings.api_tokens || [];
            const updated = tokens.map((t) =>
              t.id === id ? { ...t, last_used_at: new Date().toISOString() } : t,
            );
            await this.saveSettings(ws.id, { ...settings, api_tokens: updated });
            return { workspaceId: ws.id };
          }
        } catch {
          // wrong key/format
        }
      }
    }

    return null;
  }

  private async loadSettings(
    workspaceId: string,
  ): Promise<{ tokens: ApiToken[]; tokenSecrets: Record<string, string> }> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings = parseJsonValue<Record<string, any>>(ws?.settings_json, {});
    return {
      tokens: settings.api_tokens || [],
      tokenSecrets: settings.api_token_secrets || {},
    };
  }

  private async saveSettings(workspaceId: string, settings: Record<string, any>): Promise<void> {
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings_json: settings as any },
    });
  }
}
