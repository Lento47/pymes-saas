import { BadRequestException, Injectable, Logger, OnModuleDestroy, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { SAML, Profile } from "@node-saml/node-saml";
import Redis from "ioredis";

export interface SamlIdpConfig {
  entityId: string;
  ssoUrl: string;
  certificate: string;
  wantAuthnResponseSigned?: boolean;
}

// SAML assertion replay window: 10 minutes (well past clock skew)
const ASSERTION_TTL_SECONDS = 600;

@Injectable()
export class SamlService implements OnModuleDestroy {
  private readonly logger = new Logger(SamlService.name);

  // Redis-backed assertion cache for multi-instance replay protection.
  // Falls back to in-memory Map if Redis is unavailable (e.g. dev without Redis).
  private redis: Redis | null = null;
  private readonly memCache = new Map<string, number>();

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>("REDIS_HOST") ?? "localhost";
    const port = parseInt(config.get<string>("REDIS_PORT") ?? "6379", 10);
    const password = config.get<string>("REDIS_PASSWORD") ?? undefined;
    const username = config.get<string>("REDIS_USERNAME") ?? undefined;
    try {
      this.redis = new Redis({ host, port, password, username, lazyConnect: true,
        retryStrategy: (t) => Math.min(t * 100, 3000) });
      this.redis.on("error", () => { this.redis = null; });
      this.redis.connect().catch(() => { this.redis = null; });
    } catch {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => {});
  }

  private async rememberAssertion(id: string): Promise<void> {
    if (this.redis) {
      await this.redis.set(`saml:seen:${id}`, "1", "EX", ASSERTION_TTL_SECONDS);
      return;
    }
    // In-memory fallback — single-process only
    if (this.memCache.size > 1000) {
      const now = Date.now();
      for (const [k, exp] of this.memCache) {
        if (exp <= now) this.memCache.delete(k);
      }
    }
    this.memCache.set(id, Date.now() + ASSERTION_TTL_SECONDS * 1000);
  }

  private async isReplay(id: string): Promise<boolean> {
    if (this.redis) {
      const exists = await this.redis.exists(`saml:seen:${id}`);
      return exists === 1;
    }
    const exp = this.memCache.get(id);
    if (!exp) return false;
    if (exp <= Date.now()) { this.memCache.delete(id); return false; }
    return true;
  }

  private createSaml(
    spConfig: { entityId: string; acsUrl: string },
    idpConfig: SamlIdpConfig,
  ): SAML {
    return new SAML({
      issuer: spConfig.entityId,
      callbackUrl: spConfig.acsUrl,
      entryPoint: idpConfig.ssoUrl,
      idpCert: idpConfig.certificate,
      wantAuthnResponseSigned: idpConfig.wantAuthnResponseSigned ?? true,
      acceptedClockSkewMs: 60000,
      audience: spConfig.entityId,
    });
  }

  async getLoginUrl(workspaceSlug: string, idpConfig: SamlIdpConfig): Promise<string> {
    const baseUrl = this.config.get<string>("APP_URL") || "https://pymeshub.lat";
    const sp = {
      entityId: `${baseUrl}/saml/${workspaceSlug}/metadata`,
      acsUrl: `${baseUrl}/api/auth/saml/${workspaceSlug}/callback`,
    };

    const saml = this.createSaml(sp, idpConfig);
    return saml.getAuthorizeUrlAsync("", sp.acsUrl, {});
  }

  async validateResponse(
    workspaceSlug: string,
    idpConfig: SamlIdpConfig,
    samlResponse: string,
  ): Promise<{ email: string; nameId: string; attributes: Record<string, string> }> {
    const baseUrl = this.config.get<string>("APP_URL") || "https://pymeshub.lat";
    const sp = {
      entityId: `${baseUrl}/saml/${workspaceSlug}/metadata`,
      acsUrl: `${baseUrl}/api/auth/saml/${workspaceSlug}/callback`,
    };

    // Replay protection (C5): the SAML library validates signature,
    // audience, and NotOnOrAfter, but does not cache assertion IDs. Hash
    // the full base64 response and reject if we've seen it within the
    // 10-minute TTL window (well past clock skew).
    const responseHash = createHash("sha256").update(samlResponse).digest("hex");
    if (await this.isReplay(responseHash)) {
      this.logger.warn(`SAML replay detected for workspace ${workspaceSlug}`);
      throw new UnauthorizedException("SAML response already consumed.");
    }

    const saml = this.createSaml(sp, idpConfig);
    const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });

    // Remember assertion hash — rejects replay within TTL window
    await this.rememberAssertion(responseHash);

    const profile: Profile | null = result.profile ?? null;
    const email = ((profile?.[
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    ] as string | undefined) ||
      profile?.email ||
      profile?.mail ||
      profile?.nameID) as string;

    const nameId = profile?.nameID || email;

    if (!email) {
      this.logger.error(`SAML response missing email for workspace ${workspaceSlug}`);
      throw new BadRequestException(`SAML response missing email attribute`);
    }

    return {
      email: String(email).toLowerCase(),
      nameId: String(nameId),
      attributes: Object.fromEntries(Object.entries(profile || {}).map(([k, v]) => [k, String(v)])),
    };
  }

  generateMetadata(workspaceSlug: string): string {
    const baseUrl = this.config.get<string>("APP_URL") || "https://pymeshub.lat";
    const entityId = `${baseUrl}/saml/${workspaceSlug}/metadata`;
    const acsUrl = `${baseUrl}/api/auth/saml/${workspaceSlug}/callback`;

    return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data><X509Certificate></X509Certificate></X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  }
}
