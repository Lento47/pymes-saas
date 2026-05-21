import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { FiscalEnvironment } from "@prisma/client";

// Refresh the token this many seconds before actual expiry to avoid last-second failures
const TOKEN_EXPIRY_BUFFER_SECS = 60;

@Injectable()
export class HaciendaAuthService {
  private readonly logger = new Logger(HaciendaAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** Decrypt a sensitive setting; falls back to plaintext for legacy data. */
  private decryptSetting(
    settings: Record<string, any>,
    encKey: string,
    plainKey: string,
  ): string | undefined {
    if (settings[encKey]) {
      try {
        return this.crypto.decrypt(settings[encKey]);
      } catch {
        /* fall through */
      }
    }
    return settings[plainKey] ?? undefined;
  }

  async getAccessToken(workspaceId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    if (!workspace) {
      throw new NotFoundException("Workspace no encontrado.");
    }

    const settings = this.readSettings(workspace.settings_json);

    // Determine environment from workspace settings
    const envStr = (settings.hacienda_environment ?? "staging").toUpperCase();
    const environment =
      envStr === "PRODUCTION" ? FiscalEnvironment.PRODUCTION : FiscalEnvironment.STAGING;

    // Check the token cache before hitting Hacienda OIDC
    const cached = await this.prisma.haciendaTokenCache.findUnique({
      where: { workspace_id_environment: { workspace_id: workspaceId, environment } },
    });

    if (cached && cached.expires_at > new Date(Date.now() + TOKEN_EXPIRY_BUFFER_SECS * 1000)) {
      try {
        return this.crypto.decrypt(cached.access_token_enc);
      } catch {
        this.logger.warn(`[${workspaceId}] Token cache decrypt failed — fetching fresh token`);
      }
    }

    // Fetch a new token from Hacienda OIDC
    const password = this.decryptSetting(settings, "hacienda_password_enc", "hacienda_password");
    if (!settings.hacienda_token_url || !settings.hacienda_username || !password) {
      throw new ServiceUnavailableException(
        "Falta configuración de autenticación Hacienda en el workspace.",
      );
    }

    const body = new URLSearchParams();
    body.set("grant_type", "password");
    // ────────────────────────────────────────────────────────────────────
    // IMPORTANTE — `api-stag` ES EL CLIENT ID DE STAGING DE HACIENDA.
    // EN PRODUCCION CADA WORKSPACE DEBE TENER `hacienda_client_id` SETEADO
    // CON SU CLIENT ID PROD (`api-prod` U OTRO SEGUN HACIENDA). EL DEFAULT
    // ES SOLO PARA DEV/SANDBOX. SI ESTA CAYENDO ACA EN PROD, EL WORKSPACE
    // NO TERMINO DE CONFIGURAR FACTURACION ELECTRONICA.
    // ────────────────────────────────────────────────────────────────────
    body.set("client_id", settings.hacienda_client_id ?? "api-stag");
    body.set("username", settings.hacienda_username);
    body.set("password", password);

    const response = await fetch(settings.hacienda_token_url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(
        `No se pudo obtener token OIDC de Hacienda: ${response.status} ${text || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };
    if (!data.access_token) {
      throw new ServiceUnavailableException("Respuesta de token Hacienda sin access_token.");
    }

    // Persist to cache (best-effort; don't fail the request if cache write fails)
    const expiresIn = data.expires_in ?? 300;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    try {
      await this.prisma.haciendaTokenCache.upsert({
        where: { workspace_id_environment: { workspace_id: workspaceId, environment } },
        create: {
          workspace_id: workspaceId,
          environment,
          access_token_enc: this.crypto.encrypt(data.access_token),
          refresh_token_enc: data.refresh_token ? this.crypto.encrypt(data.refresh_token) : null,
          expires_at: expiresAt,
        },
        update: {
          access_token_enc: this.crypto.encrypt(data.access_token),
          refresh_token_enc: data.refresh_token ? this.crypto.encrypt(data.refresh_token) : null,
          expires_at: expiresAt,
        },
      });
      this.logger.log(`[${workspaceId}] Hacienda token cached, expires ${expiresAt.toISOString()}`);
    } catch (err) {
      this.logger.warn(`[${workspaceId}] Token cache write failed: ${(err as Error).message}`);
    }

    return data.access_token;
  }

  private readSettings(settingsJson: unknown): Record<string, any> {
    return settingsJson && typeof settingsJson === "object"
      ? (settingsJson as Record<string, any>)
      : {};
  }
}
