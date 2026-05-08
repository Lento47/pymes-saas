import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { SAML } from '@node-saml/node-saml';

export interface SamlIdpConfig {
  entityId: string;
  ssoUrl: string;
  certificate: string;
  wantAuthnResponseSigned?: boolean;
}

@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);

  /**
   * In-memory cache of consumed SAML response hashes to defeat replay
   * (C5). Key: sha256(SAMLResponse). Value: expiry epoch ms.
   * NOTE: single-process only; for multi-instance deployments this MUST
   * be backed by Redis. Track via TODO so ops migrates before scaling.
   */
  private readonly assertionCache = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  private rememberAssertion(id: string, notOnOrAfter: number) {
    if (this.assertionCache.size > 1000) {
      const now = Date.now();
      for (const [k, exp] of this.assertionCache) {
        if (exp <= now) this.assertionCache.delete(k);
      }
    }
    this.assertionCache.set(id, notOnOrAfter);
  }

  private isReplay(id: string): boolean {
    const exp = this.assertionCache.get(id);
    if (!exp) return false;
    if (exp <= Date.now()) {
      this.assertionCache.delete(id);
      return false;
    }
    return true;
  }

  private createSaml(spConfig: { entityId: string; acsUrl: string }, idpConfig: SamlIdpConfig): SAML {
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

  async getLoginUrl(
    workspaceSlug: string,
    idpConfig: SamlIdpConfig,
  ): Promise<string> {
    const baseUrl = this.config.get<string>('APP_URL') || 'https://pymeshub.lat';
    const sp = {
      entityId: `${baseUrl}/saml/${workspaceSlug}/metadata`,
      acsUrl: `${baseUrl}/api/auth/saml/${workspaceSlug}/callback`,
    };

    const saml = this.createSaml(sp, idpConfig);
    return saml.getAuthorizeUrlAsync('', sp.acsUrl, {});
  }

  async validateResponse(
    workspaceSlug: string,
    idpConfig: SamlIdpConfig,
    samlResponse: string,
  ): Promise<{ email: string; nameId: string; attributes: Record<string, string> }> {
    const baseUrl = this.config.get<string>('APP_URL') || 'https://pymeshub.lat';
    const sp = {
      entityId: `${baseUrl}/saml/${workspaceSlug}/metadata`,
      acsUrl: `${baseUrl}/api/auth/saml/${workspaceSlug}/callback`,
    };

    // Replay protection (C5): the SAML library validates signature,
    // audience, and NotOnOrAfter, but does not cache assertion IDs. Hash
    // the full base64 response and reject if we've seen it within the
    // 10-minute TTL window (well past clock skew).
    const responseHash = createHash('sha256').update(samlResponse).digest('hex');
    if (this.isReplay(responseHash)) {
      this.logger.warn(`SAML replay detected for workspace ${workspaceSlug}`);
      throw new UnauthorizedException('SAML response already consumed.');
    }

    const saml = this.createSaml(sp, idpConfig);
    const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });

    // Successful validation — remember this response hash so future
    // submissions of the same SAMLResponse are rejected.
    this.rememberAssertion(responseHash, Date.now() + 10 * 60 * 1000);

    const profile = result.profile || {} as Record<string, any>;
    const email = (profile?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
      (profile as any)?.email ||
      (profile as any)?.mail ||
      (profile as any)?.nameID) as string;

    const nameId = (profile as any)?.nameID || email;

    if (!email) {
      this.logger.error(`SAML response missing email for workspace ${workspaceSlug}`);
      throw new BadRequestException(`SAML response missing email attribute`);
    }

    return {
      email: String(email).toLowerCase(),
      nameId: String(nameId),
      attributes: Object.fromEntries(
        Object.entries(profile || {}).map(([k, v]) => [k, String(v)]),
      ),
    };
  }

  generateMetadata(workspaceSlug: string): string {
    const baseUrl = this.config.get<string>('APP_URL') || 'https://pymeshub.lat';
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
