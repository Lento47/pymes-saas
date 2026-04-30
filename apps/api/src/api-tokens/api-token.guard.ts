import { Injectable, CanActivate, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { ApiTokensService } from './api-tokens.service';
import { PrismaService } from '../common/prisma/prisma.service';

export const ROLES_KEY = 'api_roles';

export enum ApiRole {
  USER = 'user',       // Limited: read + basic write
  FOUNDER = 'founder', // Full CRUD + admin operations
  WORKSPACE = 'workspace', // Workspace-scoped
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

@Injectable()
export class ApiTokenGuard implements CanActivate {
  private readonly logger = new Logger(ApiTokenGuard.name);

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

    // No PymesHub token present — reject. Routes that need to accept BOTH a JWT
    // and a PymesHub API token must compose JwtAuthGuard explicitly.
    if (!token || !token.startsWith('pym_')) {
      throw new UnauthorizedException('API token required');
    }

    // Founder API key — full access (break-glass / super-admin).
    const founderKey = this.config.get<string>('PYMESHUB_FOUNDER_API_KEY');
    if (founderKey && safeEqual(token, founderKey)) {
      request.api_role = ApiRole.FOUNDER;
      request.is_super_admin = true;
      request.api_token_authenticated = true;
      await this.setWorkspaceFromHeader(request);
      this.logger.warn(
        `Founder API key used: ${request.method} ${request.url} workspace_slug=${request.headers['x-workspace-slug'] || '-'} ip=${request.ip || '-'}`,
      );
      return true;
    }

    // User API key — limited access.
    const userKey = this.config.get<string>('PYMESHUB_USER_API_KEY');
    if (userKey && safeEqual(token, userKey)) {
      request.api_role = ApiRole.USER;
      request.api_token_authenticated = true;
      await this.setWorkspaceFromHeader(request);
      return true;
    }

    // Legacy master token — treats as founder.
    const masterToken = this.config.get<string>('PYMESHUB_MASTER_API_TOKEN');
    if (masterToken && safeEqual(token, masterToken)) {
      request.api_role = ApiRole.FOUNDER;
      request.is_super_admin = true;
      request.api_token_authenticated = true;
      await this.setWorkspaceFromHeader(request);
      this.logger.warn(
        `Master API token used: ${request.method} ${request.url} workspace_slug=${request.headers['x-workspace-slug'] || '-'} ip=${request.ip || '-'}`,
      );
      return true;
    }

    // Workspace token — workspace-scoped, hashed lookup.
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
