import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiTokensService } from './api-tokens.service';
import { PrismaService } from '../common/prisma/prisma.service';

export const ROLES_KEY = 'api_roles';

export enum ApiRole {
  USER = 'user',       // Limited: read + basic write
  FOUNDER = 'founder', // Full CRUD + admin operations
  WORKSPACE = 'workspace', // Workspace-scoped
}

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    private readonly apiTokensService: ApiTokensService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization || request.headers['x-pymeshub-api-token'] || request.headers['pymeshub_founder_api_key'] || '';

    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

    // Not a PymeHub token — let JWT guard handle it
    if (!token.startsWith('pym_')) {
      return true;
    }

    // Founder API key — full access
    const founderKey = this.config.get<string>('PYMESHUB_FOUNDER_API_KEY');
    if (founderKey && token === founderKey) {
      request.api_role = ApiRole.FOUNDER;
      request.is_super_admin = true;
      request.api_token_authenticated = true;
      await this.setWorkspaceFromHeader(request);
      return true;
    }

    // User API key — limited access
    const userKey = this.config.get<string>('PYMESHUB_USER_API_KEY');
    if (userKey && token === userKey) {
      request.api_role = ApiRole.USER;
      request.api_token_authenticated = true;
      await this.setWorkspaceFromHeader(request);
      return true;
    }

    // Legacy master token — treats as founder
    const masterToken = this.config.get<string>('PYMESHUB_MASTER_API_TOKEN');
    if (masterToken && token === masterToken) {
      request.api_role = ApiRole.FOUNDER;
      request.is_super_admin = true;
      request.api_token_authenticated = true;
      await this.setWorkspaceFromHeader(request);
      return true;
    }

    // Workspace token — workspace-scoped
    const result = await this.apiTokensService.validateToken(token);
    if (!result) {
      throw new UnauthorizedException('Invalid API token');
    }

    request.api_role = ApiRole.WORKSPACE;
    request.workspace_id = result.workspaceId;
    request.api_token_authenticated = true;

    return true;
  }

  private async setWorkspaceFromHeader(request: any) {
    const slug = request.headers['x-workspace-slug'] as string;
    if (slug) {
      const ws = await this.prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
      if (ws) request.workspace_id = ws.id;
    }
  }
}
