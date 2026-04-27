import { Body, Controller, Get, Param, Post, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseJsonValue } from '../../common/prisma/json';
import { SamlService, SamlIdpConfig } from './saml.service';
import { AuthService } from '../auth.service';

@Controller('auth/saml')
export class SamlController {
  constructor(
    private readonly samlService: SamlService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Get('status/:workspaceSlug')
  async status(@Param('workspaceSlug') workspaceSlug: string) {
    try {
      const config = await this.getIdpConfig(workspaceSlug);
      return { configured: true, loginUrl: `/api/auth/saml/${workspaceSlug}/login` };
    } catch {
      return { configured: false };
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

    try {
      const auth = await this.authService.ssoLogin(ws.id, result.email.toLowerCase());
      res.redirect(`${process.env.CORS_ORIGIN?.split(',')[0] || 'https://pymeshub.lat'}/login?token=${auth.access_token}&slug=${ws.slug}`);
    } catch (err: any) {
      res.redirect(`${process.env.CORS_ORIGIN?.split(',')[0] || 'https://pymeshub.lat'}/login?error=sso_failed&message=${encodeURIComponent(err.message)}`);
    }
  }

  private async getIdpConfig(workspaceSlug: string): Promise<SamlIdpConfig> {
    const ws = await this.prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { settings_json: true },
    });

    if (!ws) throw new BadRequestException(`Workspace "${workspaceSlug}" not found`);

    const s = parseJsonValue<Record<string, any>>(ws.settings_json, {});
    const config = s.saml_idp_config as SamlIdpConfig | undefined;

    if (!config?.entityId || !config?.ssoUrl || !config?.certificate) {
      throw new BadRequestException('SAML IdP not configured for this workspace. Configure entityId, ssoUrl, and certificate in workspace settings.');
    }

    return config;
  }
}
