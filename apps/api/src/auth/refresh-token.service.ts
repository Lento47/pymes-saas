import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../common/prisma/prisma.service";
import * as crypto from "crypto";

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /** Issue a new opaque refresh token; stores SHA-256 hash. Returns raw token. */
  async create(userId: string, workspaceId: string, family?: string): Promise<string> {
    const rawToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenFamily = family ?? crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token_hash: tokenHash,
        user_id: userId,
        workspace_id: workspaceId,
        family: tokenFamily,
        expires_at: expiresAt,
      },
    });

    return rawToken;
  }

  /**
   * Validate + rotate: revoke incoming token, issue new access + refresh pair.
   * If the token is already revoked → family-wide revocation (reuse detection).
   */
  async rotate(rawToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user?: {
      id: string;
      email: string;
      name: string;
      role: string;
      is_owner: boolean;
      is_platform_admin: boolean;
      workspace: { id: string; name: string; slug: string; plan: string };
    };
  }> {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!stored) throw new UnauthorizedException("Token de refresco inválido.");

    if (stored.revoked_at) {
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      throw new UnauthorizedException("Token reutilizado — todas las sesiones han sido revocadas.");
    }

    if (stored.expires_at < new Date()) {
      throw new UnauthorizedException("Token de refresco expirado.");
    }

    const [membership, workspace] = await Promise.all([
      this.prisma.workspaceUser.findUnique({
        where: {
          workspace_id_user_id: {
            workspace_id: stored.workspace_id,
            user_id: stored.user_id,
          },
        },
      }),
      this.prisma.workspace.findUnique({
        where: { id: stored.workspace_id },
        select: { id: true, name: true, slug: true, plan: true },
      }),
    ]);
    if (!membership) throw new UnauthorizedException("Sin acceso al workspace.");

    // Atomic revoke — only succeed if token is still unrevoked.
    // If count === 0, a concurrent request already revoked it → treat as reuse.
    const revokeResult = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    if (revokeResult.count === 0) {
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      throw new UnauthorizedException("Token reutilizado — todas las sesiones han sido revocadas.");
    }

    const [newRefreshToken, accessToken] = await Promise.all([
      this.create(stored.user_id, stored.workspace_id, stored.family),
      Promise.resolve(
        this.jwtService.sign({
          sub: stored.user_id,
          email: stored.user.email,
          workspace_id: stored.workspace_id,
          role: membership.role,
          is_platform_admin: stored.user.is_platform_admin,
        }),
      ),
    ]);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: stored.user_id,
        email: stored.user.email,
        name: stored.user.name,
        role: membership.role,
        is_owner: membership.is_owner,
        is_platform_admin: stored.user.is_platform_admin,
        workspace: workspace
          ? { id: workspace.id, name: workspace.name, slug: workspace.slug, plan: workspace.plan }
          : { id: stored.workspace_id, name: "", slug: "", plan: "FREE" },
      },
    };
  }

  /** Revoke all active refresh tokens for a user in a workspace (logout). */
  async revokeAll(userId: string, workspaceId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, workspace_id: workspaceId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}
