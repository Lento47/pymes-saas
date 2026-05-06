import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  constructor(private readonly config: ConfigService) {}

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

    const saml = this.createSaml(sp, idpConfig);
    const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });

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
