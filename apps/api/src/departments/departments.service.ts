import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll(workspaceId: string) {
    return this.prisma.department.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { name: 'asc' },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar_url: true } },
          },
        },
        _count: { select: { conversations: true, channels: true } },
      },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar_url: true } },
          },
        },
        channels: { select: { id: true, name: true, type: true, status: true } },
        _count: { select: { conversations: true } },
      },
    });
    if (!dept) throw new NotFoundException('Departamento no encontrado.');
    return dept;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(workspaceId: string, dto: CreateDepartmentDto) {
    const exists = await this.prisma.department.findFirst({
      where: { workspace_id: workspaceId, name: dto.name },
    });
    if (exists) throw new ConflictException('Ya existe un departamento con ese nombre.');

    return this.prisma.department.create({
      data: {
        workspace_id: workspaceId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
      },
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(workspaceId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findOne(workspaceId, id); // throws if not found

    if (dto.name) {
      const conflict = await this.prisma.department.findFirst({
        where: { workspace_id: workspaceId, name: dto.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Nombre de departamento duplicado.');
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    // Nullify FK on conversations and channels before deleting
    await this.prisma.conversation.updateMany({
      where: { workspace_id: workspaceId, department_id: id },
      data: { department_id: null },
    });
    await this.prisma.channel.updateMany({
      where: { workspace_id: workspaceId, department_id: id },
      data: { department_id: null },
    });
    await this.prisma.department.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async addMember(workspaceId: string, deptId: string, dto: AddMemberDto) {
    await this.findOne(workspaceId, deptId);

    // Verify user belongs to workspace
    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: dto.user_id },
      },
    });
    if (!membership) throw new BadRequestException('El usuario no pertenece a este workspace.');

    const existing = await this.prisma.departmentMember.findUnique({
      where: { department_id_user_id: { department_id: deptId, user_id: dto.user_id } },
    });
    if (existing) throw new ConflictException('El usuario ya es miembro del departamento.');

    return this.prisma.departmentMember.create({
      data: {
        department_id: deptId,
        user_id: dto.user_id,
        workspace_id: workspaceId,
        is_lead: dto.is_lead ?? false,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar_url: true } },
      },
    });
  }

  async removeMember(workspaceId: string, deptId: string, userId: string) {
    await this.findOne(workspaceId, deptId);
    const member = await this.prisma.departmentMember.findUnique({
      where: { department_id_user_id: { department_id: deptId, user_id: userId } },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado.');
    await this.prisma.departmentMember.delete({
      where: { department_id_user_id: { department_id: deptId, user_id: userId } },
    });
    return { removed: true };
  }

  async getMembers(workspaceId: string, deptId: string) {
    await this.findOne(workspaceId, deptId);
    return this.prisma.departmentMember.findMany({
      where: { department_id: deptId, workspace_id: workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatar_url: true } },
      },
    });
  }
}
