import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AiProvider, AiService } from '../ai/ai.service';
import { TestAiConnectionDto } from './dto/test-ai-connection.dto';
import { AuditService } from '../audit/audit.service';
import { parseJsonRecord, serializeJson } from '../common/prisma/enterprise-sqlite-json';
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
  PermissionKey,
  ROLE_DEFAULTS,
  resolvePermissions,
} from '../auth/permissions/permission.types';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly aiService: AiService,
    private readonly audit: AuditService,
  ) {}

  private serializeWorkspace<T extends { settings_json?: any | null }>(workspace: T) {
    const settings =
      workspace.settings_json && typeof workspace.settings_json === 'object'
        ? (workspace.settings_json as Record<string, any>)
        : {};
    const taxProfile = (workspace as any).workspace_tax_profile ?? null;

    return {
      ...workspace,
      workspace_tax_profile: taxProfile,
      ai_message_finance_opt_in: settings.ai_message_finance_opt_in === true,
      ai_provider: settings.ai_provider ?? null,
      ai_model: settings.ai_model ?? null,
      hacienda_environment: settings.hacienda_environment ?? 'staging',
      hacienda_callback_url: settings.hacienda_callback_url ?? null,
      hacienda_username_set: !!(settings.hacienda_username),
      hacienda_password_set: !!(settings.hacienda_password),
      hacienda_client_id_set: !!(settings.hacienda_client_id),
      hacienda_token_url_set: !!(settings.hacienda_token_url),
      hacienda_access_token_set: !!(settings.hacienda_access_token),
      hacienda_certificate_path_set: !!(settings.hacienda_certificate_path),
      hacienda_certificate_pin_set: !!(settings.hacienda_certificate_pin),
      hacienda_signing_enabled: settings.hacienda_signing_enabled === true,
    };
  }

  // ── GET /workspaces/current ────────────────────────────────────────────────

  async getCurrent(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        country_code: true,
        timezone: true,
        locale: true,
        status: true,
        plan: true,
        settings_json: true,
        workspace_tax_profile: true,
        created_at: true,
        updated_at: true,
      },
    });

    return this.serializeWorkspace(workspace);
  }

  // ── PATCH /workspaces/current ─────────────────────────────────────────────

  async updateCurrent(workspaceId: string, dto: UpdateWorkspaceDto) {
    const {
      ai_message_finance_opt_in,
      ai_provider,
      ai_api_key,
      ai_model,
      hacienda_environment,
      hacienda_username,
      hacienda_password,
      hacienda_client_id,
      hacienda_token_url,
      hacienda_access_token,
      hacienda_callback_url,
      hacienda_certificate_path,
      hacienda_certificate_pin,
      hacienda_signing_enabled,
      tax_profile,
      ...rest
    } = dto;

    const currentWorkspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const currentSettings =
      currentWorkspace.settings_json &&
      typeof currentWorkspace.settings_json === 'object'
        ? (currentWorkspace.settings_json as Record<string, any>)
        : {};

    const nextSettings = { ...currentSettings };

    if (ai_message_finance_opt_in !== undefined) nextSettings.ai_message_finance_opt_in = ai_message_finance_opt_in;
    if (ai_provider !== undefined) nextSettings.ai_provider = ai_provider;
    if (ai_model !== undefined) nextSettings.ai_model = ai_model;
    if (ai_api_key) nextSettings.ai_api_key_enc = this.crypto.encrypt(ai_api_key);

    const setOrUnset = (key: string, value: string | undefined) => {
      if (value === undefined) return;
      if (value === '') {
        delete nextSettings[key];
      } else {
        nextSettings[key] = value;
      }
    };

    setOrUnset('hacienda_environment', hacienda_environment);
    setOrUnset('hacienda_username', hacienda_username);
    setOrUnset('hacienda_password', hacienda_password);
    setOrUnset('hacienda_client_id', hacienda_client_id);
    setOrUnset('hacienda_token_url', hacienda_token_url);
    setOrUnset('hacienda_access_token', hacienda_access_token);
    setOrUnset('hacienda_callback_url', hacienda_callback_url);
    setOrUnset('hacienda_certificate_path', hacienda_certificate_path);
    setOrUnset('hacienda_certificate_pin', hacienda_certificate_pin);

    if (hacienda_signing_enabled !== undefined) {
      nextSettings.hacienda_signing_enabled = hacienda_signing_enabled === 'true';
    }

    const settingsChanged =
      ai_message_finance_opt_in !== undefined ||
      ai_provider !== undefined ||
      ai_model !== undefined ||
      !!ai_api_key ||
      hacienda_environment !== undefined ||
      hacienda_username !== undefined ||
      hacienda_password !== undefined ||
      hacienda_client_id !== undefined ||
      hacienda_token_url !== undefined ||
      hacienda_access_token !== undefined ||
      hacienda_callback_url !== undefined ||
      hacienda_certificate_path !== undefined ||
      hacienda_certificate_pin !== undefined ||
      hacienda_signing_enabled !== undefined;

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...rest,
        ...(settingsChanged ? { settings_json: nextSettings } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        country_code: true,
        timezone: true,
        locale: true,
        status: true,
        plan: true,
        settings_json: true,
        workspace_tax_profile: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (tax_profile) {
      const hasAnyTaxProfileValue = Object.values(tax_profile).some((value) => value !== undefined && value !== '');
      if (hasAnyTaxProfileValue) {
        await this.prisma.workspaceTaxProfile.upsert({
          where: { workspace_id: workspaceId },
          update: {
            ...(tax_profile.identification_type !== undefined && { identification_type: tax_profile.identification_type }),
            ...(tax_profile.identification_number !== undefined && { identification_number: tax_profile.identification_number }),
            ...(tax_profile.legal_name !== undefined && { legal_name: tax_profile.legal_name }),
            ...(tax_profile.trade_name !== undefined && { trade_name: tax_profile.trade_name }),
            ...(tax_profile.activity_code !== undefined && { activity_code: tax_profile.activity_code }),
            ...(tax_profile.province !== undefined && { province: tax_profile.province }),
            ...(tax_profile.canton !== undefined && { canton: tax_profile.canton }),
            ...(tax_profile.district !== undefined && { district: tax_profile.district }),
            ...(tax_profile.address_detail !== undefined && { address_detail: tax_profile.address_detail }),
            ...(tax_profile.tax_email !== undefined && { tax_email: tax_profile.tax_email }),
            ...(tax_profile.phone !== undefined && { phone: tax_profile.phone }),
          },
          create: {
            workspace_id: workspaceId,
            identification_type: tax_profile.identification_type ?? '',
            identification_number: tax_profile.identification_number ?? '',
            legal_name: tax_profile.legal_name ?? '',
            activity_code: tax_profile.activity_code ?? '',
            trade_name: tax_profile.trade_name,
            province: tax_profile.province,
            canton: tax_profile.canton,
            district: tax_profile.district,
            address_detail: tax_profile.address_detail,
            tax_email: tax_profile.tax_email,
            phone: tax_profile.phone,
          },
        });
      }
    }

    const refreshed = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        country_code: true,
        timezone: true,
        locale: true,
        status: true,
        plan: true,
        settings_json: true,
        workspace_tax_profile: true,
        created_at: true,
        updated_at: true,
      },
    });

    return this.serializeWorkspace(refreshed);
  }

  async getAiFinanceMessageConsent(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const settings =
      workspace.settings_json && typeof workspace.settings_json === 'object'
        ? (workspace.settings_json as Record<string, any>)
        : {};

    return settings.ai_message_finance_opt_in === true;
  }

  async testAiConnection(workspaceId: string, dto: TestAiConnectionDto) {
    const savedConfig = await this.aiService.getWorkspaceConfig(workspaceId);
    const provider = (dto.ai_provider ?? savedConfig?.provider) as AiProvider | undefined;

    if (!provider) {
      throw new BadRequestException('Selecciona un proveedor de IA antes de probar la conexion.');
    }

    const canReuseSavedKey = savedConfig?.provider === provider;
    const apiKey = dto.ai_api_key || (canReuseSavedKey ? savedConfig?.api_key : undefined);
    if (!apiKey) {
      throw new BadRequestException('Ingresa una API key o guarda una clave valida para este proveedor antes de probar la conexion.');
    }

    const model =
      dto.ai_model ||
      (canReuseSavedKey ? savedConfig?.model : undefined) ||
      this.aiService.getDefaultModel(provider);

    try {
      const result = await this.aiService.testConnection({
        provider,
        model,
        api_key: apiKey,
      });

      return {
        ok: true,
        ...result,
      };
    } catch (error) {
      throw new BadRequestException((error as Error).message || 'No se pudo validar la conexion con el proveedor de IA.');
    }
  }

  // ── GET /workspaces/current/api-keys ──────────────────────────────────────

  async getApiKeys(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const settings =
      workspace.settings_json && typeof workspace.settings_json === 'object'
        ? (workspace.settings_json as Record<string, any>)
        : {};

    return {
      openai_api_key_set: !!(settings.openai_api_key && settings.openai_api_key !== ''),
      resend_api_key_set: !!(settings.resend_api_key && settings.resend_api_key !== ''),
      anthropic_api_key_set: !!(settings.anthropic_api_key && settings.anthropic_api_key !== ''),
      gemini_api_key_set: !!(settings.gemini_api_key && settings.gemini_api_key !== ''),
      grok_api_key_set: !!(settings.grok_api_key && settings.grok_api_key !== ''),
      kimi_api_key_set: !!(settings.kimi_api_key && settings.kimi_api_key !== ''),
      hacienda_username_set: !!(settings.hacienda_username && settings.hacienda_username !== ''),
      hacienda_password_set: !!(settings.hacienda_password && settings.hacienda_password !== ''),
      hacienda_client_id_set: !!(settings.hacienda_client_id && settings.hacienda_client_id !== ''),
      hacienda_token_url_set: !!(settings.hacienda_token_url && settings.hacienda_token_url !== ''),
      hacienda_access_token_set: !!(settings.hacienda_access_token && settings.hacienda_access_token !== ''),
      hacienda_certificate_path_set: !!(settings.hacienda_certificate_path && settings.hacienda_certificate_path !== ''),
      hacienda_certificate_pin_set: !!(settings.hacienda_certificate_pin && settings.hacienda_certificate_pin !== ''),
    };
  }

  // ── GET /workspaces/current/stats ─────────────────────────────────────────

  async getStats(workspaceId: string) {
    const [contacts, conversations, tasks, documents, automations, members] = await Promise.all([
      this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
      this.prisma.conversation.count({ where: { workspace_id: workspaceId } }),
      this.prisma.task.count({ where: { workspace_id: workspaceId } }),
      this.prisma.document.count({ where: { workspace_id: workspaceId } }),
      this.prisma.automationRule.count({ where: { workspace_id: workspaceId } }),
      this.prisma.workspaceUser.count({ where: { workspace_id: workspaceId } }),
    ]);

    const activeConversations = await this.prisma.conversation.count({
      where: { workspace_id: workspaceId, status: { in: ['NEW', 'OPEN'] } },
    });

    const pendingTasks = await this.prisma.task.count({
      where: { workspace_id: workspaceId, status: { in: ['TODO', 'IN_PROGRESS'] } },
    });

    const totalDocumentSize = await this.prisma.document.aggregate({
      where: { workspace_id: workspaceId },
      _sum: { file_size: true },
    });

    return {
      contacts,
      conversations,
      activeConversations,
      tasks,
      pendingTasks,
      documents,
      documentStorageBytes: totalDocumentSize._sum.file_size ?? 0,
      automations,
      members,
    };
  }

  // ── GET /workspaces/current/stats/today ────────────────────────────────────

  async getTodayStats(workspaceId: string) {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [new_conversations, received_messages, created_tasks, uploaded_documents] = await Promise.all([
      this.prisma.conversation.count({
        where: { workspace_id: workspaceId, created_at: { gte: startOfToday } },
      }),
      this.prisma.message.count({
        where: {
          workspace_id: workspaceId,
          direction: 'INBOUND',
          created_at: { gte: startOfToday },
        },
      }),
      this.prisma.task.count({
        where: { workspace_id: workspaceId, created_at: { gte: startOfToday } },
      }),
      this.prisma.document.count({
        where: { workspace_id: workspaceId, created_at: { gte: startOfToday } },
      }),
    ]);

    return { new_conversations, received_messages, created_tasks, uploaded_documents };
  }

  // ── GET /workspaces/current/export ────────────────────────────────────────

  async exportData(workspaceId: string, type: string) {
    if (type === 'contacts') {
      return this.prisma.contact.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, full_name: true, email: true, phone: true, type: true, company_name: true, created_at: true },
        orderBy: { created_at: 'desc' },
      });
    }
    if (type === 'tasks') {
      return this.prisma.task.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, title: true, status: true, priority: true, due_at: true, created_at: true },
        orderBy: { created_at: 'desc' },
      });
    }
    if (type === 'conversations') {
      return this.prisma.conversation.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, subject: true, status: true, priority: true, category: true, created_at: true },
        orderBy: { created_at: 'desc' },
      });
    }
    throw new Error('Invalid export type. Use: contacts | tasks | conversations');
  }

  // ── GET /workspaces/current/members ───────────────────────────────────────

  async getMembers(workspaceId: string) {
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
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      is_owner: m.is_owner,
      joined_at: m.created_at,
      user: m.user,
    }));
  }

  // ── POST /workspaces/current/members/invite ───────────────────────────────
  // Flujo simplificado: si el email ya existe en users, se agrega directo.
  // En producción: enviar email con token firmado y redirigir a /auth/accept-invite.

  async inviteUser(
    workspaceId: string,
    requestingUser: AuthUser,
    dto: InviteUserDto,
  ) {
    // Solo ADMIN u OWNER pueden invitar
    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Solo ADMIN u OWNER pueden invitar usuarios.');
    }

    // No se puede invitar OWNERs adicionales
    if (dto.role === 'OWNER') {
      throw new BadRequestException(
        'No se puede invitar con rol OWNER. Transfiere la propiedad explícitamente.',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Crear usuario en estado INVITED — recibirá email para setear contraseña
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.email.split('@')[0],
          status: 'INVITED',
        },
      });
    }

    const existing = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: user.id },
      },
    });
    if (existing) {
      throw new ConflictException('El usuario ya es miembro de este workspace.');
    }

    const membership = await this.prisma.workspaceUser.create({
      data: {
        workspace_id: workspaceId,
        user_id: user.id,
        role: dto.role,
        is_owner: false,
      },
    });

    // TODO: enviar email de invitación con link firmado

    return {
      message: `Invitación enviada a ${dto.email}`,
      membership_id: membership.id,
    };
  }

  // ── PATCH /workspaces/current/members/:userId/role ────────────────────────

  async changeMemberRole(
    workspaceId: string,
    requestingUser: AuthUser,
    targetUserId: string,
    dto: ChangeMemberRoleDto,
  ) {
    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Sin permisos para cambiar roles.');
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });
    if (!membership) throw new NotFoundException('Miembro no encontrado.');

    if (membership.is_owner) {
      throw new ForbiddenException(
        'No se puede cambiar el rol del owner. Transfiere la propiedad primero.',
      );
    }

    if (dto.role === 'OWNER') {
      throw new BadRequestException('Usa la ruta de transferencia de propiedad.');
    }

    const updated = await this.prisma.workspaceUser.update({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
      data: { role: dto.role },
    });

    await this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: 'member.role_changed',
      entity_type: 'workspace_user',
      entity_id: updated.id,
      before: { role: membership.role },
      after: { role: dto.role },
    });

    return updated;
  }

  // ── DELETE /workspaces/current/members/:userId ────────────────────────────

  async removeMember(
    workspaceId: string,
    requestingUser: AuthUser,
    targetUserId: string,
  ) {
    if (targetUserId === requestingUser.id) {
      throw new BadRequestException('No puedes removerte a ti mismo.');
    }

    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Sin permisos para remover miembros.');
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });
    if (!membership) throw new NotFoundException('Miembro no encontrado.');
    if (membership.is_owner) {
      throw new ForbiddenException('No se puede remover al owner.');
    }

    await this.prisma.workspaceUser.delete({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });

    await this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: 'member.removed',
      entity_type: 'workspace_user',
      entity_id: membership.id,
      before: { user_id: targetUserId, role: membership.role },
      after: null,
    });

    return { message: 'Miembro removido del workspace.' };
  }

  // ── Granular permissions ─────────────────────────────────────────────────────

  /** Public catalog — lists all permission keys with labels and role defaults. */
  getPermissionsCatalog() {
    return {
      permissions: PERMISSION_KEYS.map((key) => ({
        key,
        label: PERMISSION_LABELS[key],
        description: PERMISSION_DESCRIPTIONS[key],
      })),
      role_defaults: ROLE_DEFAULTS,
    };
  }

  /** Returns resolved permissions + raw overrides for a single member. */
  async getMemberPermissions(workspaceId: string, targetUserId: string) {
    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });
    if (!membership) throw new NotFoundException('Miembro no encontrado.');

    const overrides = membership.permissions_json
      ? (parseJsonRecord(membership.permissions_json) as Record<string, boolean>)
      : null;
    const resolved = resolvePermissions(membership.role, overrides);

    return {
      user_id: targetUserId,
      role: membership.role,
      is_owner: membership.is_owner,
      overrides: overrides ?? {},
      resolved,
    };
  }

  /**
   * Update permission overrides for a member.
   *
   * Body shape: { "can_delete_contacts": true, "can_export_data": null, ... }
   * - `true`  → grant (override to true)
   * - `false` → revoke (override to false)
   * - `null`  → remove override (fall back to role default)
   */
  async updateMemberPermissions(
    workspaceId: string,
    requestingUser: AuthUser,
    targetUserId: string,
    changes: Record<string, boolean | null>,
  ) {
    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Sin permisos para modificar permisos.');
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });
    if (!membership) throw new NotFoundException('Miembro no encontrado.');
    if (membership.is_owner) {
      throw new BadRequestException('El OWNER siempre tiene todos los permisos.');
    }
    // An ADMIN cannot modify another ADMIN's permissions—only OWNER can.
    if (membership.role === 'ADMIN' && requestingUser.role !== 'OWNER') {
      throw new ForbiddenException(
        'Solo el OWNER puede modificar los permisos de otros ADMIN.',
      );
    }

    const current = membership.permissions_json
      ? (parseJsonRecord(membership.permissions_json) as Record<string, boolean>)
      : {};
    const next: Record<string, boolean> = { ...current };
    const validKeys = new Set<string>(PERMISSION_KEYS);

    for (const [key, value] of Object.entries(changes)) {
      if (!validKeys.has(key)) {
        throw new BadRequestException(`Permiso desconocido: ${key}`);
      }
      if (value === null) {
        delete next[key];
      } else if (typeof value === 'boolean') {
        next[key] = value;
      } else {
        throw new BadRequestException(
          `El valor para ${key} debe ser true, false, o null.`,
        );
      }
    }

    const finalOverrides = Object.keys(next).length > 0 ? next : null;

    const updated = await this.prisma.workspaceUser.update({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
      data: { permissions_json: serializeJson(finalOverrides) },
    });

    await this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: 'member.permissions_updated',
      entity_type: 'workspace_user',
      entity_id: updated.id,
      before: {
        overrides: membership.permissions_json
          ? (parseJsonRecord(membership.permissions_json) as Record<string, boolean>)
          : {},
      },
      after: { overrides: finalOverrides ?? {} },
    });

    return this.getMemberPermissions(workspaceId, targetUserId);
  }
}
