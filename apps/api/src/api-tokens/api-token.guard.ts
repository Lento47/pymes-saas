import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTokensService } from './api-tokens.service';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    private readonly apiTokensService: ApiTokensService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization || request.headers['x-pymeshub-api-token'] || '';

    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

    if (!token.startsWith('pym_')) {
      return true;
    }

    // Master token — full super-admin access
    const masterToken = this.config.get<string>('PYMESHUB_MASTER_API_TOKEN');
    if (masterToken && token === masterToken) {
      request.is_super_admin = true;
      request.api_token_authenticated = true;
      const slug = request.headers['x-workspace-slug'] as string;
      if (slug) {
        const ws = await this.prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
        if (ws) request.workspace_id = ws.id;
      }
      return true;
    }

    const result = await this.apiTokensService.validateToken(token);
    if (!result) {
      throw new UnauthorizedException('Invalid API token');
    }

    request.workspace_id = result.workspaceId;
    request.api_token_authenticated = true;

    return true;
  }
}
