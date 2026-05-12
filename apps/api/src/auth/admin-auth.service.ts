import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtPayload } from './strategies/jwt.strategy';
import * as crypto from 'crypto';

const AUTH0_DOMAIN = (process.env.AUTH0_DOMAIN ?? '').trim();
const AUTH0_CLIENT_ID = (process.env.AUTH0_CLIENT_ID ?? '').trim();
const AUTH0_CLIENT_SECRET = (process.env.AUTH0_CLIENT_SECRET ?? '').trim();
const ADMIN_DOMAINS = (process.env.AUTH0_ADMIN_DOMAINS ?? '').split(',').map(d => d.trim()).filter(Boolean);
const PUBLIC_URL = (process.env.PUBLIC_URL ?? 'https://pymeshub.lat').trim();

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  buildAuthUrl(): string {
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: AUTH0_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${PUBLIC_URL}/api/auth/admin/callback`,
      scope: 'openid email profile',
      state: `${state}|/admin`,
      nonce,
    });
    return `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, stateRaw: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: any;
  }> {
    const [state] = (stateRaw ?? '').split('|');
    if (!state || state.length < 16) {
      throw new UnauthorizedException('Invalid state parameter');
    }

    const tokenRes = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: AUTH0_CLIENT_ID,
        client_secret: AUTH0_CLIENT_SECRET,
        code,
        redirect_uri: `${PUBLIC_URL}/api/auth/admin/callback`,
      }),
    });

    if (!tokenRes.ok) {
      this.logger.error(`Auth0 token exchange failed: ${tokenRes.status}`);
      throw new UnauthorizedException('Authentication failed');
    }

    const tokens = await tokenRes.json() as any;
    const accessToken = tokens.access_token;
    if (!accessToken) {
      throw new UnauthorizedException('No access token from Auth0');
    }

    const userRes = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      throw new UnauthorizedException('Failed to get user info');
    }

    const profile = await userRes.json() as any;
    const email: string = (profile.email ?? '').toLowerCase();
    const name: string = profile.name ?? profile.nickname ?? email.split('@')[0];

    if (!email) {
      throw new UnauthorizedException('No email in Auth0 profile');
    }

    const domainOk = ADMIN_DOMAINS.some(d => email.endsWith(`@${d}`));
    if (!domainOk) {
      this.logger.warn(`Admin login rejected: ${email} not in whitelist`);
      throw new UnauthorizedException('Este correo no tiene acceso de administrador.');
    }

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        workspace_users: {
          include: { workspace: true },
          orderBy: { created_at: 'asc' },
          take: 1,
        },
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          status: 'ACTIVE',
          is_platform_admin: true,
        },
        include: {
          workspace_users: { include: { workspace: true }, take: 1 },
        },
      });
    }

    if (!user.is_platform_admin) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { is_platform_admin: true },
      });
    }

    let membership = user.workspace_users?.[0];
    if (!membership) {
      const workspace = await this.prisma.workspace.create({
        data: {
          name: `Admin Hub — ${name || email.split('@')[0]}`,
          slug: `admin-${crypto.randomBytes(4).toString('hex')}`,
          plan: 'BUSINESS_PLUS',
        },
      });

      membership = await this.prisma.workspaceUser.create({
        data: {
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'OWNER',
          is_owner: true,
        },
        include: { workspace: true },
      });
    }

    const access_token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      workspace_id: membership.workspace_id,
      role: membership.role,
      is_platform_admin: true,
    } satisfies JwtPayload);

    const refresh_token = await this.refreshTokens.create(user.id, membership.workspace_id);

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: membership.role,
        is_owner: membership.is_owner,
        is_platform_admin: true,
        workspace: {
          id: membership.workspace.id,
          name: membership.workspace.name,
          slug: membership.workspace.slug,
          plan: membership.workspace.plan,
        },
      },
    };
  }
}
