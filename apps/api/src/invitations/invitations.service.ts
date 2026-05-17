import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WorkspaceUserRole } from '../common/types/enums';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { Resend } from 'resend';

import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { AuditService } from '../audit/audit.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { parseJsonStringArray, serializeJson } from '../common/prisma/enterprise-sqlite-json';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateRawToken(): string {
    // 32 bytes → 43 char url-safe string
    return randomBytes(32).toString('base64url');
  }

  private buildAcceptUrl(rawToken: string): string {
    const base =
      this.config.get<string>('APP_URL') ??
      this.config.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/#/accept-invite?token=${rawToken}`;
  }

  private async sendInvitationEmail(
    to: string,
    workspaceName: string,
    inviterName: string,
    rawToken: string,
  ): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const fromEmail =
      this.config.get<string>('SYSTEM_EMAIL_FROM') ?? 'no-reply@pymeshub.app';
    const fromName =
      this.config.get<string>('SYSTEM_EMAIL_FROM_NAME') ?? 'Pymeshub';

    if (!apiKey) {
      this.logger.warn(
        `[invitation] RESEND_API_KEY not configured — skipping email to ${to}. Accept URL: ${this.buildAcceptUrl(
          rawToken,
        )}`,
      );
      return;
    }

    const acceptUrl = this.buildAcceptUrl(rawToken);
    const resend = new Resend(apiKey);

    try {
      await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: `${inviterName} te invitó a ${workspaceName} en Pymeshub`,
        html: this.renderEmailHtml(workspaceName, inviterName, acceptUrl),
        text: `${inviterName} te invitó a unirte a ${workspaceName} en Pymeshub.\n\nAcepta tu invitación aquí:\n${acceptUrl}\n\nEl enlace expira en ${INVITATION_TTL_DAYS} días.`,
      });
    } catch (err: any) {
      this.logger.error(`Failed to send invitation email to ${to}`, err?.message ?? err);
      // Don't throw — invitation record exists; ADMIN can resend.
    }
  }

  private renderEmailHtml(
    workspaceName: string,
    inviterName: string,
    acceptUrl: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:4px;border:1px solid #e5e5e5;padding:40px;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#181818;">Te invitaron a un workspace</h1>
      <p style="margin:0 0 8px;color:#525252;font-size:14px;line-height:1.6;">
        <strong style="color:#181818;">${this.escape(inviterName)}</strong> te invitó a unirte a
        <strong style="color:#181818;">${this.escape(workspaceName)}</strong> en Pymeshub.
      </p>
      <p style="margin:0 0 24px;color:#525252;font-size:14px;line-height:1.6;">
        Haz clic en el botón para aceptar la invitación y crear tu cuenta.
      </p>
      <a href="${acceptUrl}" style="display:inline-block;background:#1a73e8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 20px;border-radius:4px;">
        Aceptar invitación
      </a>
      <p style="margin:24px 0 0;color:#8a8a8a;font-size:12px;line-height:1.6;">
        O copia esta URL en tu navegador:<br/>
        <span style="word-break:break-all;color:#525252;">${acceptUrl}</span>
      </p>
      <p style="margin:24px 0 0;color:#8a8a8a;font-size:12px;">
        Este enlace expira en ${INVITATION_TTL_DAYS} días. Si no esperabas esta invitación, ignora este correo.
      </p>
    </div>
  </body>
</html>
    `.trim();
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Admin endpoints ────────────────────────────────────────────────────────

  /** List pending/sent invitations in a workspace. */
  async list(workspaceId: string) {
    const invitations = await this.prisma.invitation.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
      include: {
        invited_by: { select: { id: true, name: true, email: true } },
      },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      department_ids: inv.department_ids,
      invited_by: inv.invited_by,
      expires_at: inv.expires_at,
      accepted_at: inv.accepted_at,
      revoked_at: inv.revoked_at,
      last_sent_at: inv.last_sent_at,
      send_count: inv.send_count,
      created_at: inv.created_at,
      status: this.computeStatus(inv),
    }));
  }

  private computeStatus(inv: {
    accepted_at: Date | null;
    revoked_at: Date | null;
    expires_at: Date;
  }): 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' {
    if (inv.accepted_at) return 'ACCEPTED';
    if (inv.revoked_at) return 'REVOKED';
    if (inv.expires_at < new Date()) return 'EXPIRED';
    return 'PENDING';
  }

  /** Create a new invitation and send email. Only ADMIN/OWNER. */
  async create(
    workspaceId: string,
    requestingUser: AuthUser,
    dto: CreateInvitationDto,
  ) {
    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Solo ADMIN u OWNER pueden invitar usuarios.');
    }

    if (dto.role === WorkspaceUserRole.OWNER) {
      throw new BadRequestException(
        'No se puede invitar con rol OWNER. Transfiere la propiedad explícitamente.',
      );
    }

    const email = dto.email.trim().toLowerCase();

    // Prevent inviting an existing active member
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const membership = await this.prisma.workspaceUser.findUnique({
        where: {
          workspace_id_user_id: {
            workspace_id: workspaceId,
            user_id: existingUser.id,
          },
        },
      });
      if (membership) {
        throw new ConflictException('Ese usuario ya es miembro de este workspace.');
      }
    }

    // Revoke any pending invitation for same email/workspace so we have a clean slate
    await this.prisma.invitation.updateMany({
      where: {
        workspace_id: workspaceId,
        email,
        accepted_at: null,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });

    // Validate department ids
    if (dto.department_ids?.length) {
      const depts = await this.prisma.department.findMany({
        where: { id: { in: dto.department_ids }, workspace_id: workspaceId },
        select: { id: true },
      });
      if (depts.length !== dto.department_ids.length) {
        throw new BadRequestException('Uno o más departamentos no existen.');
      }
    }

    const rawToken = this.generateRawToken();
    const tokenHash = this.hash(rawToken);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        workspace_id: workspaceId,
        email,
        role: dto.role as any,
        department_ids: serializeJson(dto.department_ids ?? []) ?? '[]',
        token_hash: tokenHash,
        invited_by_id: requestingUser.id,
        expires_at: expiresAt,
      },
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    await this.sendInvitationEmail(
      email,
      workspace?.name ?? 'Pymeshub',
      requestingUser.email,
      rawToken,
    );

    await this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: 'invitation.created',
      entity_type: 'invitation',
      entity_id: invitation.id,
      after: { email, role: dto.role, department_ids: dto.department_ids ?? [] },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expires_at: invitation.expires_at,
      message: `Invitación enviada a ${email}`,
    };
  }

  /** Resend an existing pending invitation (new token, same invitation record). */
  async resend(workspaceId: string, requestingUser: AuthUser, invitationId: string) {
    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Solo ADMIN u OWNER pueden reenviar invitaciones.');
    }

    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspace_id: workspaceId },
    });
    if (!invitation) throw new NotFoundException('Invitación no encontrada.');
    if (invitation.accepted_at)
      throw new BadRequestException('La invitación ya fue aceptada.');
    if (invitation.revoked_at)
      throw new BadRequestException('La invitación fue revocada.');

    const rawToken = this.generateRawToken();
    const tokenHash = this.hash(rawToken);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        token_hash: tokenHash,
        expires_at: expiresAt,
        last_sent_at: new Date(),
        send_count: { increment: 1 },
      },
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    await this.sendInvitationEmail(
      invitation.email,
      workspace?.name ?? 'Pymeshub',
      requestingUser.email,
      rawToken,
    );

    await this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: 'invitation.resent',
      entity_type: 'invitation',
      entity_id: invitation.id,
    });

    return { message: `Invitación reenviada a ${invitation.email}` };
  }

  /** Revoke a pending invitation. */
  async revoke(workspaceId: string, requestingUser: AuthUser, invitationId: string) {
    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Solo ADMIN u OWNER pueden revocar invitaciones.');
    }

    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspace_id: workspaceId },
    });
    if (!invitation) throw new NotFoundException('Invitación no encontrada.');
    if (invitation.accepted_at)
      throw new BadRequestException('No se puede revocar una invitación ya aceptada.');
    if (invitation.revoked_at) {
      return { message: 'La invitación ya estaba revocada.' };
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { revoked_at: new Date() },
    });

    await this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: 'invitation.revoked',
      entity_type: 'invitation',
      entity_id: invitation.id,
    });

    return { message: 'Invitación revocada.' };
  }

  // ── Public endpoints (unauthenticated) ─────────────────────────────────────

  /** Look up an invitation by raw token (for pre-filling the accept form). */
  async getByToken(rawToken: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token_hash: this.hash(rawToken) },
      include: { workspace: { select: { name: true, slug: true } } },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación inválida o expirada.');
    }
    if (invitation.accepted_at) {
      throw new BadRequestException('Esta invitación ya fue aceptada.');
    }
    if (invitation.revoked_at) {
      throw new BadRequestException('Esta invitación fue revocada.');
    }
    if (invitation.expires_at < new Date()) {
      throw new BadRequestException('Esta invitación expiró. Pide una nueva.');
    }

    return {
      email: invitation.email,
      role: invitation.role,
      workspace: invitation.workspace,
      expires_at: invitation.expires_at,
    };
  }

  /** Accept an invitation: create/activate user, set password, issue tokens. */
  async accept(dto: AcceptInvitationDto) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token_hash: this.hash(dto.token) },
      include: { workspace: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación inválida.');
    }
    if (invitation.accepted_at) {
      throw new BadRequestException('Esta invitación ya fue aceptada.');
    }
    if (invitation.revoked_at) {
      throw new BadRequestException('Esta invitación fue revocada.');
    }
    if (invitation.expires_at < new Date()) {
      throw new BadRequestException('Esta invitación expiró.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const displayName = dto.name?.trim() || invitation.email.split('@')[0];

    // Create or update the user, create membership, link departments, mark invitation accepted.
    const result = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: invitation.email } });

      if (user) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: dto.name?.trim() ?? user.name,
            password_hash: passwordHash,
            status: 'ACTIVE',
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            name: displayName,
            password_hash: passwordHash,
            status: 'ACTIVE',
          },
        });
      }

      // Ensure membership exists (idempotent)
      const existing = await tx.workspaceUser.findUnique({
        where: {
          workspace_id_user_id: {
            workspace_id: invitation.workspace_id,
            user_id: user.id,
          },
        },
      });

      const membership = existing
        ? existing
        : await tx.workspaceUser.create({
            data: {
              workspace_id: invitation.workspace_id,
              user_id: user.id,
              role: invitation.role,
              is_owner: false,
            },
          });

      // Department memberships
      const deptIds = Array.isArray(invitation.department_ids) ? invitation.department_ids as string[] : [];
      if (deptIds.length > 0) {
        for (const deptId of deptIds) {
          await tx.departmentMember.upsert({
            where: {
              department_id_user_id: { department_id: deptId, user_id: user.id },
            },
            create: {
              department_id: deptId,
              user_id: user.id,
              workspace_id: invitation.workspace_id,
            },
            update: {},
          });
        }
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { accepted_at: new Date() },
      });

      return { user, membership };
    });

    const access_token = this.jwtService.sign({
      sub: result.user.id,
      email: result.user.email,
      workspace_id: invitation.workspace_id,
      role: result.membership.role,
      is_platform_admin: result.user.is_platform_admin ?? false,
    });

    const refresh_token = await this.refreshTokenService.create(
      result.user.id,
      invitation.workspace_id,
    );

    await this.audit.log(invitation.workspace_id, {
      user_id: result.user.id,
      action: 'invitation.accepted',
      entity_type: 'invitation',
      entity_id: invitation.id,
      after: { email: invitation.email, role: invitation.role },
    });

    return {
      access_token,
      refresh_token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.membership.role,
        is_owner: result.membership.is_owner,
        workspace: {
          id: invitation.workspace.id,
          name: invitation.workspace.name,
          slug: invitation.workspace.slug,
          plan: invitation.workspace.plan,
        },
      },
    };
  }
}
