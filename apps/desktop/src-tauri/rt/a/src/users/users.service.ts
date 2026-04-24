import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /users (listar miembros del workspace actual) ─────────────────────

  async findAll(workspaceId: string) {
    const members = await this.prisma.workspaceUser.findMany({
      where: { workspace_id: workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar_url: true,
            status: true,
            created_at: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return members.map((m) => ({
      ...m.user,
      role: m.role,
      is_owner: m.is_owner,
    }));
  }

  // ── GET /users/:id ─────────────────────────────────────────────────────────

  async findOne(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar_url: true,
            status: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Usuario no encontrado en este workspace.');
    }

    return { ...member.user, role: member.role, is_owner: member.is_owner };
  }

  // ── PATCH /users/me ────────────────────────────────────────────────────────

  async updateMe(requestingUser: AuthUser, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: requestingUser.id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        status: true,
        updated_at: true,
      },
    });
  }

  // ── PATCH /users/:id (solo ADMIN/OWNER pueden editar a otros) ─────────────

  async updateById(
    workspaceId: string,
    requestingUser: AuthUser,
    targetUserId: string,
    dto: UpdateUserDto,
  ) {
    if (
      requestingUser.id !== targetUserId &&
      !['ADMIN', 'OWNER'].includes(requestingUser.role)
    ) {
      throw new ForbiddenException('Solo puedes editar tu propio perfil.');
    }

    await this.findOne(workspaceId, targetUserId); // valida que pertenece al workspace

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        status: true,
        updated_at: true,
      },
    });
  }
}
