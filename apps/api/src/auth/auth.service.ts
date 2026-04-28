import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InviteTokenPayload } from './invite-token.types';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { RefreshTokenService } from './refresh-token.service';
import { DemoDataService } from '../demo/demo-data.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly demoData: DemoDataService,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, workspaceSlug: string | undefined) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const passwordMatch = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );
    if (!passwordMatch) throw new UnauthorizedException('Credenciales inválidas.');

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuario inactivo o suspendido.');
    }

    // Auto-detect workspace if no slug provided
    let effectiveSlug = workspaceSlug;
    if (!effectiveSlug) {
      const memberships = await this.prisma.workspaceUser.findMany({
        where: { user_id: user.id },
        select: { workspace: { select: { id: true, slug: true, name: true } } },
      });

      if (memberships.length === 0) {
        throw new UnauthorizedException('No tenés acceso a ningún workspace.');
      }

      if (memberships.length === 1) {
        effectiveSlug = memberships[0].workspace.slug;
      } else {
        throw new UnauthorizedException(
          'MULTIPLE_WORKSPACES:' +
          JSON.stringify(memberships.map((m) => ({
            id: m.workspace.id,
            slug: m.workspace.slug,
            name: m.workspace.name,
          })))
        );
      }
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { slug: effectiveSlug },
    });
    if (!workspace) throw new UnauthorizedException('Workspace no encontrado.');

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: user.id,
        },
      },
    });
    if (!membership) throw new UnauthorizedException('Sin acceso a este workspace.');

    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: workspace.id,
      role: membership.role,
      is_platform_admin: user.is_platform_admin,
    });

    const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

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
        is_platform_admin: user.is_platform_admin,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
        },
      },
    };
  }

  // ── Register (primer usuario = owner del nuevo workspace) ─────────────────

  async register(dto: RegisterDto) {
    if (dto.invite_token) {
      return this.acceptInvite({
        token: dto.invite_token,
        name: dto.name,
        password: dto.password,
      });
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El email ya está registrado.');

    const password_hash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        status: 'ACTIVE',
        ...(password_hash && { password_hash }),
      },
    });

    const slug = await this.generateUniqueWorkspaceSlug();

    const workspace = await this.prisma.workspace.create({
      data: {
        name: `${dto.name}'s Workspace`,
        slug,
        status: 'ACTIVE',
        plan: 'FREE',
        workspace_users: {
          create: {
            user_id: user.id,
            role: 'OWNER',
            is_owner: true,
          },
        },
      },
    });

    // Auto-populate demo data (fire-and-forget — does not block registration)
    this.demoData.populateDemoWorkspace(workspace.id, workspace.name).catch((err) => {
      // Silent — demo data population failures are non-critical
    });

    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: workspace.id,
      role: 'OWNER',
      is_platform_admin: false,
    });

    const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: 'OWNER',
        is_owner: true,
        is_platform_admin: false,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
        },
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
      },
    };
  }

  async ssoLogin(workspaceId: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado para SSO.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuario inactivo o suspendido.');
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: user.id,
        },
      },
    });

    if (!membership) {
      // Auto-provision user into workspace if not a member
      const ws = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { plan: true },
      });

      await this.prisma.workspaceUser.create({
        data: {
          workspace_id: workspaceId,
          user_id: user.id,
          role: 'AGENT',
          is_owner: false,
        },
      });
    }

    const effectiveMembership = membership || {
      role: 'AGENT',
      is_owner: false,
    };

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) throw new UnauthorizedException('Workspace no encontrado.');

    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: workspace.id,
      role: effectiveMembership.role,
      is_platform_admin: user.is_platform_admin,
    });

    const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: effectiveMembership.role,
        is_owner: effectiveMembership.is_owner,
        is_platform_admin: user.is_platform_admin,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
        },
      },
    };
  }

  async getInvitePreview(rawToken?: string) {
    const payload = this.verifyInviteToken(rawToken);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: payload.workspace_id },
      select: { id: true, name: true, slug: true },
    });
    if (!workspace) throw new NotFoundException('Workspace de invitación no encontrado.');

    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true, email: true, name: true, status: true, password_hash: true },
    });
    if (!user) throw new NotFoundException('Usuario invitado no encontrado.');

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: user.id,
        },
      },
    });
    if (!membership) throw new NotFoundException('La invitación ya no es válida.');

    return {
      email: user.email,
      name: user.name,
      requires_account_setup: user.status === 'INVITED' || !user.password_hash,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      },
      role: membership.role,
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const payload = this.verifyInviteToken(dto.token);

    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (!user) throw new NotFoundException('Usuario invitado no encontrado.');

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: payload.workspace_id },
    });
    if (!workspace || workspace.slug !== payload.workspace_slug) {
      throw new NotFoundException('Workspace de invitación no encontrado.');
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: user.id,
        },
      },
    });
    if (!membership) throw new BadRequestException('La invitación ya no es válida.');

    let resolvedUser = user;
    const requiresAccountSetup = user.status === 'INVITED' || !user.password_hash;

    if (requiresAccountSetup) {
      if (!dto.name?.trim()) {
        throw new BadRequestException('El nombre es requerido para activar la invitación.');
      }
      if (!dto.password) {
        throw new BadRequestException('La contraseña es requerida para activar la invitación.');
      }

      const password_hash = await bcrypt.hash(dto.password, 12);
      resolvedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: dto.name.trim(),
          status: 'ACTIVE',
          password_hash,
        },
      });
    } else if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuario inactivo o suspendido.');
    }

    const access_token = this.signToken({
      sub: resolvedUser.id,
      email: resolvedUser.email,
      workspace_id: workspace.id,
      role: membership.role,
      is_platform_admin: resolvedUser.is_platform_admin,
    });

    const refresh_token = await this.refreshTokenService.create(resolvedUser.id, workspace.id);

    return {
      access_token,
      refresh_token,
      user: {
        id: resolvedUser.id,
        email: resolvedUser.email,
        name: resolvedUser.name,
        avatar_url: resolvedUser.avatar_url,
        role: membership.role,
        is_owner: membership.is_owner,
        is_platform_admin: resolvedUser.is_platform_admin,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
        },
      },
    };
  }

  // ── Me ─────────────────────────────────────────────────────────────────────

  async getMe(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceUser.findUniqueOrThrow({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
      },
      include: {
        user: { select: { id: true, email: true, name: true, avatar_url: true, status: true, created_at: true, is_platform_admin: true } },
        workspace: { select: { id: true, name: true, slug: true, plan: true, timezone: true, locale: true } },
      },
    });

    return {
      ...membership.user,
      role: membership.role,
      is_owner: membership.is_owner,
      workspace: membership.workspace,
    };
  }

  // ── My workspaces (for workspace switcher) ────────────────────────────────

  async getMyWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceUser.findMany({
      where: { user_id: userId },
      include: {
        workspace: { select: { id: true, name: true, slug: true, plan: true, status: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return memberships.map((m) => ({
      workspace: m.workspace,
      role: m.role,
      is_owner: m.is_owner,
    }));
  }

  // ── Switch workspace — returns new access_token for target workspace ──────

  async switchWorkspace(userId: string, workspaceSlug: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
    });
    if (!workspace) throw new UnauthorizedException('Workspace no encontrado.');

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspace.id, user_id: userId },
      },
      include: { user: { select: { is_platform_admin: true } } },
    });
    if (!membership) throw new UnauthorizedException('Sin acceso a este workspace.');

    const access_token = this.signToken({
      sub: userId,
      email: (await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })).email,
      workspace_id: workspace.id,
      role: membership.role,
      is_platform_admin: membership.user.is_platform_admin,
    });

    const refresh_token = await this.refreshTokenService.create(userId, workspace.id);

    return {
      access_token,
      refresh_token,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
      },
      role: membership.role,
      is_owner: membership.is_owner,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private signToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  /**
   * Generates a random, URL-safe workspace slug (base64url, ~72 bits of entropy)
   * and retries on the astronomically rare collision.
   */
  private async generateUniqueWorkspaceSlug(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomBytes(9).toString('base64url');
      const exists = await this.prisma.workspace.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new Error('Could not generate unique workspace slug.');
  }

  async resetPassword(email: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (newPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password_hash },
    });

    return { message: 'Contraseña actualizada correctamente.' };
  }

  private verifyInviteToken(rawToken?: string): InviteTokenPayload {
    if (!rawToken) throw new BadRequestException('Invite token requerido.');

    try {
      const payload = this.jwtService.verify<InviteTokenPayload>(rawToken);
      if (payload.type !== 'workspace-invite') {
        throw new BadRequestException('Invite token inválido.');
      }
      return payload;
    } catch {
      throw new BadRequestException('Invite token inválido o expirado.');
    }
  }
}
