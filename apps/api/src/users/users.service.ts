import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
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
    if (file.size > 2 * 1024 * 1024 || file.buffer.length > 2 * 1024 * 1024) {
      throw new BadRequestException("La imagen no puede superar 2 MB.");
    }

    let image: Buffer;
    try {
      const source = sharp(file.buffer, { limitInputPixels: 25_000_000, failOn: "warning" });
      const metadata = await source.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("Unsupported image");
      // Decode before storing, apply phone orientation and strip image metadata.
      image = await source.rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch {
      throw new BadRequestException("La imagen no es válida. Usá JPEG, PNG o WebP de hasta 25 megapíxeles.");
    }

    const version = randomUUID();
    const key = `avatars/${userId}/${version}.webp`;
    await this.storage.upload(key, image, "image/webp");
    const avatar_url = `/api/users/${userId}/avatar?v=${version}`;
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { avatar_url } });
    } catch (error) {
      // A failed profile update must leave the previous photo intact.
      await this.storage.delete(key);
      throw error;
    }
    return { avatar_url };
  }

  async getAvatar(workspaceId: string, userId: string) {
    // Check current membership on every request, before accessing storage.
    const user = await this.findOne(workspaceId, userId);
    if (!user?.avatar_url) throw new NotFoundException("Avatar no encontrado.");

    // Only stored, server-generated versions select an object; never accept a key from a URL parameter.
    const version = user.avatar_url.match(/\?v=([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/)?.[1];
    if (version) {
      const data = await this.storage.download(`avatars/${userId}/${version}.webp`, true);
      if (!data) throw new NotFoundException("Avatar no encontrado.");
      return { data, contentType: "image/webp" };
    }

    // Older uploads stored no extension in avatar_url. Preserve JPEG precedence
    // and recover PNG/WebP uploads when the JPEG object does not exist.
    const extensions = user.avatar_url.endsWith(".png") ? ["png"] : user.avatar_url.endsWith(".webp") ? ["webp"] : ["jpg", "png", "webp"];
    for (const ext of extensions) {
      const data = await this.storage.download(`avatars/${userId}.${ext}`, true);
      if (data) return { data, contentType: `image/${ext === "jpg" ? "jpeg" : ext}` };
    }
    throw new NotFoundException("Avatar no encontrado.");
  }
}
