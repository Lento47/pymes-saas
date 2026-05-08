import { Body, Controller, Get, Param, Post, Put, Res, Req, BadRequestException, UseGuards, Logger, ForbiddenException } from '@nestjs/common';
import { Response, Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseJsonValue } from '../../common/prisma/json';
import { CryptoService } from '../../common/crypto/crypto.service';
import { SamlService, SamlIdpConfig } from './saml.service';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('auth/saml')
export class SamlController {
  private readonly logger = new Logger(SamlController.name);

  constructor(
    private readonly samlService: SamlService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly crypto: CryptoService,
  ) {}

  // ─── Public endpoints ─────────────────────────────────────────────────

  @Get('status/:workspaceSlug')
  async status(@Param('workspaceSlug') workspaceSlug: string) {
    try {
      const config = await this.getSsoConfig(workspaceSlug);
      return {
        configured: !!config?.enabled && !!config?.idp_entity_id && !!config?.idp_sso_url,
        enabled: config?.enabled ?? false,
        loginUrl: `/api/auth/saml/${workspaceSlug}/login`,
      };
    } catch {
      return { configured: false, enabled: false };
    }
  }

  @Get(':workspaceSlug/metadata')
  metadata(@Param('workspaceSlug') workspaceSlug: string) {
    return this.samlService.generateMetadata(workspaceSlug);
  }

  @Get(':workspaceSlug/login')
  async login(@Param('workspaceSlug') workspaceSlug: string, @Res() res: Response) {
    const idpConfig = await this.getIdpConfig(workspaceSlug);
    const url = await this.samlService.getLoginUrl(workspaceSlug, idpConfig);
    res.redirect(url);
  }

  @Post(':workspaceSlug/callback')
  async callback(
    @Param('workspaceSlug') workspaceSlug: string,
    @Body('SAMLResponse') samlResponse: string,
    @Res() res: Response,
  ) {
    if (!samlResponse) {
      throw new BadRequestException('SAMLResponse is required');
    }

    const idpConfig = await this.getIdpConfig(workspaceSlug);
    const result = await this.samlService.validateResponse(workspaceSlug, idpConfig, samlResponse);

    const ws = await this.prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!ws) {
      throw new BadRequestException(`Workspace "${workspaceSlug}" not found`);
    }

    const baseRedirect = process.env.CORS_ORIGIN?.split(',')[0] || 'https://PymesHub.lat';
    try {
      // ssoLogin verifies the user exists and is a member of the
      // workspace. We then mint a 60-second one-shot exchange code
      // and put THAT in the redirect URL — never the access/refresh
      // token. The SPA redeems the code at POST /auth/sso-exchange.
      // C4: bounds Referer / browser-history exposure to a 60s
      // non-renewable code instead of a long-lived bearer token.
      const auth = await this.authService.ssoLogin(ws.id, result.email.toLowerCase());
      const code = this.authService.mintSsoExchangeCode(auth.user.id, ws.id);
      this.logger.log(`SAML login success: ${result.email} → workspace ${ws.id}`);
      res.redirect(`${baseRedirect}/login?code=${encodeURIComponent(code)}&slug=${ws.slug}`);
    } catch (err: any) {
      this.logger.warn(`SAML login failed for ${result.email}: ${err.message}`);
      // Don't echo err.message into the URL — it ends up in proxy logs.
      res.redirect(`${baseRedirect}/login?error=sso_failed`);
    }
  }

  // ─── Admin endpoints — SSO Config Management ─────────────────────────

  @Get('config/:workspaceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async getConfig(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    const user = (req as any).user;
    if (user?.workspace_id !== workspaceId) {
      throw new ForbiddenException('Cannot access SSO config for another workspace');
    }
    const config = await this.prisma.workspaceSsoConfig.findUnique({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        workspace_id: true,
        enabled: true,
        idp_entity_id: true,
        idp_sso_url: true,
        idp_certificate_encrypted: true,
        metadata_url: true,
        name_id_format: true,
        email_attribute: true,
        first_name_attribute: true,
        last_name_attribute: true,
        role_attribute: true,
        allow_password_fallback_for_admins: true,
        require_sso_for_members: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (config) {
      const { idp_certificate_encrypted, ...safe } = config;
      return { ...safe, has_certificate: !!idp_certificate_encrypted };
    }
    return { workspace_id: workspaceId, enabled: false };
  }

  @Put('config/:workspaceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async upsertConfig(
    @Param('workspaceId') workspaceId: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    if (user?.workspace_id !== workspaceId) {
      throw new ForbiddenException('Cannot modify SSO config for another workspace');
    }

    // Encrypt certificate if provided as plaintext
    let certEncrypted: string | undefined;
    if (data.idp_certificate) {
      certEncrypted = this.crypto.encrypt(data.idp_certificate);
    }

    const existing = await this.prisma.workspaceSsoConfig.findUnique({
      where: { workspace_id: workspaceId },
    });

    const config = existing
      ? await this.prisma.workspaceSsoConfig.update({
          where: { workspace_id: workspaceId },
          data: {
            enabled: data.enabled,
            idp_entity_id: data.idp_entity_id,
            idp_sso_url: data.idp_sso_url,
            idp_certificate_encrypted: certEncrypted ?? undefined,
            metadata_url: data.metadata_url,
            name_id_format: data.name_id_format,
            email_attribute: data.email_attribute,
            first_name_attribute: data.first_name_attribute,
            last_name_attribute: data.last_name_attribute,
            role_attribute: data.role_attribute,
            allow_password_fallback_for_admins: data.allow_password_fallback_for_admins ?? true,
            require_sso_for_members: data.require_sso_for_members ?? false,
          },
        })
      : await this.prisma.workspaceSsoConfig.create({
          data: {
            workspace: { connect: { id: workspaceId } },
            enabled: data.enabled ?? false,
            idp_entity_id: data.idp_entity_id,
            idp_sso_url: data.idp_sso_url,
            idp_certificate_encrypted: certEncrypted,
            metadata_url: data.metadata_url,
            name_id_format: data.name_id_format,
            email_attribute: data.email_attribute,
            first_name_attribute: data.first_name_attribute,
            last_name_attribute: data.last_name_attribute,
            role_attribute: data.role_attribute,
            allow_password_fallback_for_admins: data.allow_password_fallback_for_admins ?? true,
            require_sso_for_members: data.require_sso_for_members ?? false,
          },
        });

    this.logger.log(`SAML SSO config ${existing ? 'updated' : 'created'} for workspace ${workspaceId}`);

    // Return without certificate
    const { idp_certificate_encrypted, ...safe } = config;
    return { ...safe, has_certificate: !!idp_certificate_encrypted };
  }

  @Post('config/:workspaceId/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async enableSso(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    const user = (req as any).user;
    if (user?.workspace_id !== workspaceId) {
      throw new ForbiddenException();
    }
    await this.prisma.workspaceSsoConfig.update({
      where: { workspace_id: workspaceId },
      data: { enabled: true },
    });
    this.logger.log(`SAML SSO enabled for workspace ${workspaceId}`);
    return { enabled: true };
  }

  @Post('config/:workspaceId/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async disableSso(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    const user = (req as any).user;
    if (user?.workspace_id !== workspaceId) {
      throw new ForbiddenException();
    }
    await this.prisma.workspaceSsoConfig.update({
      where: { workspace_id: workspaceId },
      data: { enabled: false },
    });
    this.logger.log(`SAML SSO disabled for workspace ${workspaceId}`);
    return { enabled: false };
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  private async getSsoConfig(workspaceSlug: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true, settings_json: true },
    });
    if (!ws) return null;

    // Prefer typed table
    const typed = await this.prisma.workspaceSsoConfig.findUnique({
      where: { workspace_id: ws.id },
    });
    if (typed?.enabled) return typed;

    return null;
  }

  private async getIdpConfig(workspaceSlug: string): Promise<SamlIdpConfig> {
    const ws = await this.prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true, settings_json: true },
    });

    if (!ws) throw new BadRequestException(`Workspace "${workspaceSlug}" not found`);

    // Prefer typed table
    const typed = await this.prisma.workspaceSsoConfig.findUnique({
      where: { workspace_id: ws.id },
    });

    if (typed?.enabled && typed?.idp_entity_id && typed?.idp_sso_url && typed?.idp_certificate_encrypted) {
      const certDecrypted = this.crypto.decrypt(typed.idp_certificate_encrypted);
      return {
        entityId: typed.idp_entity_id,
        ssoUrl: typed.idp_sso_url,
        certificate: certDecrypted,
        wantAuthnResponseSigned: true,
      };
    }

    // Fallback: legacy settings_json
    const s = parseJsonValue<Record<string, any>>(ws.settings_json, {});
    const config = s.saml_idp_config as SamlIdpConfig | undefined;

    if (!config?.entityId || !config?.ssoUrl || !config?.certificate) {
      throw new BadRequestException('SAML IdP not configured for this workspace. Configure entityId, ssoUrl, and certificate in workspace settings.');
    }

    return config;
  }
}
