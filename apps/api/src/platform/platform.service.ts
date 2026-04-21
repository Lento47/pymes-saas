import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AssignMemberDto } from './dto/assign-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /platform/workspaces ──────────────────────────────────────────────

  async listWorkspaces() {
    const workspaces = await this.prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        created_at: true,
        _count: { select: { workspace_users: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return workspaces.map((w) => ({
      ...w,
      member_count: w._count.workspace_users,
    }));
  }

  // ── GET /platform/workspaces/:slug/members ────────────────────────────────

  async listMembers(slug: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    const members = await (this.prisma.workspaceUser as any).findMany({
      where: { workspace_id: workspace.id },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatar_url: true, status: true, is_platform_admin: true },
        },
      },
      orderBy: { created_at: 'asc' },
    }) as any[];

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      is_owner: m.is_owner,
      joined_at: m.created_at,
      user: m.user,
    }));
  }

  // ── POST /platform/workspaces/:slug/members ───────────────────────────────

  async assignMember(slug: string, dto: AssignMemberDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException(`Usuario con email ${dto.email} no existe. Debe registrarse primero.`);

    const existing = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspace.id, user_id: user.id },
      },
    });
    if (existing) throw new ConflictException('El usuario ya es miembro de este workspace.');

    const membership = await this.prisma.workspaceUser.create({
      data: {
        workspace_id: workspace.id,
        user_id: user.id,
        role: dto.role ?? 'AGENT',
        is_owner: false,
      },
    });

    return { message: `${dto.email} agregado al workspace ${workspace.name}.`, membership_id: membership.id };
  }

  // ── PATCH /platform/workspaces/:slug/members/:userId/role ─────────────────

  async updateMemberRole(slug: string, userId: string, dto: UpdateMemberRoleDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    const membership = await this.prisma.workspaceUser.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
    });
    if (!membership) throw new NotFoundException('Membresía no encontrada.');

    return this.prisma.workspaceUser.update({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
      data: { role: dto.role },
    });
  }

  // ── DELETE /platform/workspaces/:slug/members/:userId ─────────────────────

  async removeMember(slug: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    const membership = await this.prisma.workspaceUser.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
    });
    if (!membership) throw new NotFoundException('Membresía no encontrada.');
    if (membership.is_owner) throw new ConflictException('No se puede remover al owner del workspace.');

    await this.prisma.workspaceUser.delete({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
    });

    return { message: 'Acceso revocado.' };
  }

  // ── GET /platform/users?email=... ────────────────────────────────────────

  async searchUsers(email?: string) {
    return (this.prisma.user as any).findMany({
      where: email ? { email: { contains: email, mode: 'insensitive' } } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        status: true,
        is_platform_admin: true,
        created_at: true,
        workspace_users: {
          include: {
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      take: 50,
      orderBy: { created_at: 'desc' },
    });
  }
}
