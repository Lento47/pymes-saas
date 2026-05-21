import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../common/prisma/prisma.service";
import { StorageService } from "../common/storage/storage.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { AuthUser } from "../auth/strategies/jwt.strategy";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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
      orderBy: { created_at: "asc" },
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
      throw new NotFoundException("Usuario no encontrado en este workspace.");
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
    if (requestingUser.id !== targetUserId && !["ADMIN", "OWNER"].includes(requestingUser.role)) {
      throw new ForbiddenException("Solo puedes editar tu propio perfil.");
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

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password_hash: true },
    });
    if (!user?.password_hash)
      throw new BadRequestException("Tu cuenta no tiene contraseña (posiblemente usás SSO).");

    const valid = await bcrypt.compare(dto.current_password, user.password_hash);
    if (!valid) throw new BadRequestException("La contraseña actual es incorrecta.");

    const password_hash = await bcrypt.hash(dto.new_password, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password_hash } });
    return { message: "Contraseña actualizada correctamente." };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      throw new BadRequestException("Formato no permitido. Usá JPEG, PNG o WebP.");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException("La imagen no puede superar 2 MB.");
    }

    const ext = file.mimetype.split("/")[1] === "jpeg" ? "jpg" : file.mimetype.split("/")[1];
    const key = `avatars/${userId}.${ext}`;
    await this.storage.upload(key, file.buffer, file.mimetype);

    const avatar_url = `/api/users/${userId}/avatar`;
    await this.prisma.user.update({ where: { id: userId }, data: { avatar_url } });
    return { avatar_url };
  }

  async getAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar_url: true },
    });
    if (!user?.avatar_url) throw new NotFoundException("Avatar no encontrado.");

    const key = `avatars/${userId}.${user.avatar_url.endsWith(".png") ? "png" : user.avatar_url.endsWith(".webp") ? "webp" : "jpg"}`;
    const data = await this.storage.download(key);
    const ext = key.split(".").pop() || "jpg";
    return { data, contentType: `image/${ext === "jpg" ? "jpeg" : ext}` };
  }
}
