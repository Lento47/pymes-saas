import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, workspaceSlug: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(user as any).password_hash) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const passwordMatch = await bcrypt.compare(
      dto.password,
      (user as any).password_hash,
    );
    if (!passwordMatch) throw new UnauthorizedException('Credenciales inválidas.');

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuario inactivo o suspendido.');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
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
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('El email ya está registrado.');

    const password_hash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        status: 'ACTIVE',
        ...(password_hash && { password_hash } as any),
      },
    });

    if (dto.invite_token) {
      throw new BadRequestException(
        'Invite token: implementar en WorkspacesService.acceptInvite()',
      );
    }

    const slug = dto.email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');

    const workspace = await this.prisma.workspace.create({
      data: {
        name: `${dto.name}'s Workspace`,
        slug: `${slug}-${Date.now()}`,
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

    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: workspace.id,
      role: 'OWNER',
    });

    const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

    return { access_token, refresh_token };
  }

  // ── Me ─────────────────────────────────────────────────────────────────────

  async getMe(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceUser.findUniqueOrThrow({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
      },
      include: {
        user: { select: { id: true, email: true, name: true, avatar_url: true, status: true, created_at: true } },
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  private signToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }
}
