import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  TooManyRequestsException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as zlib from "zlib";
import { promisify } from "util";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { StorageService } from "../common/storage/storage.service";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { InviteUserDto } from "./dto/invite-user.dto";
import { ChangeMemberRoleDto } from "./dto/change-member-role.dto";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { AiProvider, AiService } from "../ai/ai.service";
import { TestAiConnectionDto } from "./dto/test-ai-connection.dto";
import { EmailService } from "../email/email.service";
import { EventsGateway } from "../gateways/events.gateway";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { AuditService } from "../audit/audit.service";

const gzipAsync = promisify(zlib.gzip);

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly aiService: AiService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly events: EventsGateway,
    private readonly planLimits: PlanLimitsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private serializeWorkspace<T extends { settings_json?: unknown; workspace_tax_profile?: unknown }>(
    workspace: T,
  ) {
    const settings =
      workspace.settings_json && typeof workspace.settings_json === "object"
        ? (workspace.settings_json as Record<string, unknown>)
        : {};
    const taxProfile = workspace.workspace_tax_profile ?? null;

    return {
      ...workspace,
      workspace_tax_profile: taxProfile,
      settings: {
        quick_start_progress: settings.quick_start_progress ?? ({} as Record<string, boolean>),
      },
      ai_message_finance_opt_in: settings.ai_message_finance_opt_in === true,
      ai_provider: settings.ai_provider ?? null,
      ai_model: settings.ai_model ?? null,
      ai_agent_provider: settings.ai_agent_provider ?? "workers_ai",
      ai_agent_model: settings.ai_agent_model ?? "",
      ai_agent_providers: Array.isArray(settings.ai_agent_providers) ? settings.ai_agent_providers : null,
      ai_custom_api_enabled: settings.ai_custom_api_enabled !== false,
      ai_business_prompt: settings.ai_business_prompt ?? "",
      ai_business_products_services: settings.ai_business_products_services ?? "",
      ai_business_policies: settings.ai_business_policies ?? "",
      ai_business_tone: settings.ai_business_tone ?? "",
      ai_agent_assignment_mode:
        settings.ai_agent_assignment_mode ?? "conversation_assignee",
      ai_agent_default_assignee_id: settings.ai_agent_default_assignee_id ?? "",
      ai_agent_intent_assignees:
        settings.ai_agent_intent_assignees &&
        typeof settings.ai_agent_intent_assignees === "object" &&
        !Array.isArray(settings.ai_agent_intent_assignees)
          ? settings.ai_agent_intent_assignees
          : {},
      // IMPORTANTE — DEFAULT A `staging` PARA DEV. EN PROD, CADA WORKSPACE
      // DEBE FIJAR EXPLICITAMENTE `hacienda_environment='production'` EN
      // SUS SETTINGS, SINO LAS FACTURAS VAN AL AMBIENTE STAGING DE HACIENDA.
      hacienda_environment: settings.hacienda_environment ?? "staging",
      hacienda_callback_url: settings.hacienda_callback_url ?? null,
      hacienda_username_set: !!settings.hacienda_username,
      hacienda_password_set: !!(settings.hacienda_password_enc || settings.hacienda_password),
      hacienda_client_id_set: !!settings.hacienda_client_id,
      hacienda_token_url_set: !!settings.hacienda_token_url,
      hacienda_access_token_set: !!(
        settings.hacienda_access_token_enc || settings.hacienda_access_token
      ),
      hacienda_certificate_path_set: !!settings.hacienda_certificate_path,
      hacienda_certificate_pin_set: !!(
        settings.hacienda_certificate_pin_enc || settings.hacienda_certificate_pin
      ),
      hacienda_signing_enabled: settings.hacienda_signing_enabled === true,
      ai_agent_auto_active: settings.ai_agent_auto_active === true,
      ai_voice_enabled: settings.ai_voice_enabled === true,
      ai_voice_id: (settings.ai_voice_id as string) ?? "",
      elevenlabs_api_key: settings.elevenlabs_api_key_enc ? "[configurada]" : "",
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
        logo_url: true,
        settings_json: true,
        workspace_tax_profile: true,
        created_at: true,
        updated_at: true,
      },
    });

    return this.serializeWorkspace(workspace);
  }

  // ── GET /workspaces/current/dashboard ────────────────────────────────────

  async getDashboard(workspaceId: string) {
    const [workspace, stats] = await Promise.all([
      this.getCurrent(workspaceId),
      this.getStats(workspaceId),
    ]);
    return { workspace, stats };
  }

  // ── GET /workspaces/current/subscription ─────────────────────────────────

  async getSubscription(workspaceId: string) {
    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        plan: true,
        status: true,
        provider: true,
        provider_customer_id: true,
        provider_subscription_id: true,
        current_period_start: true,
        current_period_end: true,
        trial_ends_at: true,
        cancel_at_period_end: true,
      },
    });

    if (!sub) {
      return null;
    }

    const limits = this.planLimits.getLimits(sub.plan);
    return { ...sub, limits };
  }

  // ── PATCH /workspaces/current ─────────────────────────────────────────────

  async updateCurrent(workspaceId: string, dto: UpdateWorkspaceDto) {
    const {
      name,
      country_code,
      timezone,
      locale,
      status,
      ai_message_finance_opt_in,
      ai_provider,
      ai_api_key,
      ai_model,
      settings_json,
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
      elevenlabs_api_key,
      ...rest
    } = dto;

    const currentWorkspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const currentSettings =
      currentWorkspace.settings_json && typeof currentWorkspace.settings_json === "object"
        ? (currentWorkspace.settings_json as Record<string, any>)
        : {};

    const nextSettings = { ...currentSettings };

    if (ai_message_finance_opt_in !== undefined)
      nextSettings.ai_message_finance_opt_in = ai_message_finance_opt_in;
    if (ai_provider !== undefined) nextSettings.ai_provider = ai_provider;
    if (ai_model !== undefined) nextSettings.ai_model = ai_model;
    if (ai_api_key) nextSettings.ai_api_key_enc = this.crypto.encrypt(ai_api_key);

    // Merge raw settings_json overrides (used by SAML config, etc.)
    if (settings_json && typeof settings_json === "object") {
      Object.assign(nextSettings, settings_json);
    }

    const setOrUnset = (key: string, value: string | undefined) => {
      if (value === undefined) return;
      if (value === "") {
        delete nextSettings[key];
      } else {
        nextSettings[key] = value;
      }
    };

    // Encrypt sensitive fields; non-sensitive fields stored as plain text.
    const setOrUnsetEnc = (plainKey: string, encKey: string, value: string | undefined) => {
      if (value === undefined) return;
      if (value === "") {
        delete nextSettings[plainKey];
        delete nextSettings[encKey];
      } else {
        nextSettings[encKey] = this.crypto.encrypt(value);
        delete nextSettings[plainKey]; // remove legacy plaintext key if present
      }
    };

    setOrUnset("hacienda_environment", hacienda_environment);
    setOrUnset("hacienda_username", hacienda_username);
    setOrUnsetEnc("hacienda_password", "hacienda_password_enc", hacienda_password);
    setOrUnset("hacienda_client_id", hacienda_client_id);
    setOrUnset("hacienda_token_url", hacienda_token_url);
    setOrUnsetEnc("hacienda_access_token", "hacienda_access_token_enc", hacienda_access_token);
    setOrUnset("hacienda_callback_url", hacienda_callback_url);
    setOrUnset("hacienda_certificate_path", hacienda_certificate_path);
    setOrUnsetEnc(
      "hacienda_certificate_pin",
      "hacienda_certificate_pin_enc",
      hacienda_certificate_pin,
    );
    setOrUnsetEnc("elevenlabs_api_key", "elevenlabs_api_key_enc", elevenlabs_api_key);

    if (hacienda_signing_enabled !== undefined) {
      nextSettings.hacienda_signing_enabled = hacienda_signing_enabled === "true";
    }

    const settingsChanged =
      settings_json !== undefined ||
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
      hacienda_signing_enabled !== undefined ||
      elevenlabs_api_key !== undefined;

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...rest,
        ...(name !== undefined ? { name } : {}),
        ...(country_code !== undefined ? { country_code } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(locale !== undefined ? { locale } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(settingsChanged ? { settings_json: nextSettings } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo_url: true,
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
      const hasAnyTaxProfileValue = Object.values(tax_profile).some(
        (value) => value !== undefined && value !== "",
      );
      if (hasAnyTaxProfileValue) {
        await this.prisma.workspaceTaxProfile.upsert({
          where: { workspace_id: workspaceId },
          update: {
            ...(tax_profile.identification_type !== undefined && {
              identification_type: tax_profile.identification_type,
            }),
            ...(tax_profile.identification_number !== undefined && {
              identification_number: tax_profile.identification_number,
            }),
            ...(tax_profile.legal_name !== undefined && { legal_name: tax_profile.legal_name }),
            ...(tax_profile.trade_name !== undefined && { trade_name: tax_profile.trade_name }),
            ...(tax_profile.activity_code !== undefined && {
              activity_code: tax_profile.activity_code,
            }),
            ...(tax_profile.province !== undefined && { province: tax_profile.province }),
            ...(tax_profile.canton !== undefined && { canton: tax_profile.canton }),
            ...(tax_profile.district !== undefined && { district: tax_profile.district }),
            ...(tax_profile.address_detail !== undefined && {
              address_detail: tax_profile.address_detail,
            }),
            ...(tax_profile.tax_email !== undefined && { tax_email: tax_profile.tax_email }),
            ...(tax_profile.phone !== undefined && { phone: tax_profile.phone }),
          },
          create: {
            workspace_id: workspaceId,
            identification_type: tax_profile.identification_type ?? "",
            identification_number: tax_profile.identification_number ?? "",
            legal_name: tax_profile.legal_name ?? "",
            activity_code: tax_profile.activity_code ?? "",
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
        logo_url: true,
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

    const serialized = this.serializeWorkspace(refreshed);
    this.events.emitWorkspaceUpdated(workspaceId, serialized);

    if (settingsChanged) {
      if (hacienda_username || hacienda_client_id || hacienda_token_url)
        this.markQuickStartStep(workspaceId, "hacienda_configured");
      if (ai_provider || ai_api_key || ai_message_finance_opt_in !== undefined)
        this.markQuickStartStep(workspaceId, "invoicing_configured");
    }

    return serialized;
  }

  async getAiFinanceMessageConsent(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const settings =
      workspace.settings_json && typeof workspace.settings_json === "object"
        ? (workspace.settings_json as Record<string, any>)
        : {};

    return settings.ai_message_finance_opt_in === true;
  }

  async testAiConnection(workspaceId: string, dto: TestAiConnectionDto) {
    const savedConfig = await this.aiService.getWorkspaceConfig(workspaceId);
    const provider = (dto.ai_provider ?? savedConfig?.provider) as AiProvider | undefined;

    if (!provider) {
      throw new BadRequestException("Selecciona un proveedor de IA antes de probar la conexion.");
    }

    const canReuseSavedKey = savedConfig?.provider === provider;
    const apiKey = dto.ai_api_key || (canReuseSavedKey ? savedConfig?.api_key : undefined);
    if (!apiKey) {
      throw new BadRequestException(
        "Ingresa una API key o guarda una clave valida para este proveedor antes de probar la conexion.",
      );
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

      this.markQuickStartStep(workspaceId, "team_invited");

      return {
        ok: true,
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(
        (error as Error).message || "No se pudo validar la conexion con el proveedor de IA.",
      );
    }
  }

  // ── GET /workspaces/current/api-keys ──────────────────────────────────────

  async getApiKeys(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const settings =
      workspace.settings_json && typeof workspace.settings_json === "object"
        ? (workspace.settings_json as Record<string, any>)
        : {};

    return {
      openai_api_key_set: !!(settings.openai_api_key && settings.openai_api_key !== ""),
      resend_api_key_set: !!(settings.resend_api_key && settings.resend_api_key !== ""),
      anthropic_api_key_set: !!(settings.anthropic_api_key && settings.anthropic_api_key !== ""),
      gemini_api_key_set: !!(settings.gemini_api_key && settings.gemini_api_key !== ""),
      grok_api_key_set: !!(settings.grok_api_key && settings.grok_api_key !== ""),
      kimi_api_key_set: !!(settings.kimi_api_key && settings.kimi_api_key !== ""),
      hacienda_username_set: !!(settings.hacienda_username && settings.hacienda_username !== ""),
      hacienda_password_set: !!(settings.hacienda_password && settings.hacienda_password !== ""),
      hacienda_client_id_set: !!(settings.hacienda_client_id && settings.hacienda_client_id !== ""),
      hacienda_token_url_set: !!(settings.hacienda_token_url && settings.hacienda_token_url !== ""),
      hacienda_access_token_set: !!(
        settings.hacienda_access_token && settings.hacienda_access_token !== ""
      ),
      hacienda_certificate_path_set: !!(
        settings.hacienda_certificate_path && settings.hacienda_certificate_path !== ""
      ),
      hacienda_certificate_pin_set: !!(
        settings.hacienda_certificate_pin && settings.hacienda_certificate_pin !== ""
      ),
    };
  }

  // ── GET /workspaces/current/stats ─────────────────────────────────────────

  async getStats(workspaceId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [row] = await this.prisma.rawQuery<
      Array<{
        contacts: number | bigint;
        conversations: number | bigint;
        tasks: number | bigint;
        documents: number | bigint;
        automations: number | bigint;
        members: number | bigint;
        active_conversations: number | bigint;
        pending_tasks: number | bigint;
        total_document_bytes: number | bigint;
        monthly_revenue: number | string;
        prev_month_revenue: number | string;
      }>
    >(
      `SELECT
        (SELECT COUNT(*) FROM contacts      WHERE workspace_id = $1)::int AS contacts,
        (SELECT COUNT(*) FROM conversations WHERE workspace_id = $1)::int AS conversations,
        (SELECT COUNT(*) FROM tasks         WHERE workspace_id = $1)::int AS tasks,
        (SELECT COUNT(*) FROM documents     WHERE workspace_id = $1)::int AS documents,
        (SELECT COUNT(*) FROM automation_rules WHERE workspace_id = $1)::int AS automations,
        (SELECT COUNT(*) FROM workspace_users   WHERE workspace_id = $1)::int AS members,
        (SELECT COUNT(*) FROM conversations WHERE workspace_id = $1 AND status IN ('NEW','OPEN'))::int AS active_conversations,
        (SELECT COUNT(*) FROM tasks         WHERE workspace_id = $1 AND status IN ('TODO','IN_PROGRESS'))::int AS pending_tasks,
        COALESCE((SELECT SUM(file_size) FROM documents WHERE workspace_id = $1), 0)::bigint AS total_document_bytes,
        COALESCE((SELECT SUM(amount) FROM invoices WHERE workspace_id = $1 AND created_at >= $2 AND status != 'CANCELLED'), 0) AS monthly_revenue,
        COALESCE((SELECT SUM(amount) FROM invoices WHERE workspace_id = $1 AND created_at >= $3 AND created_at <= $4 AND status != 'CANCELLED'), 0) AS prev_month_revenue`,
      workspaceId,
      startOfMonth,
      startOfPrevMonth,
      endOfPrevMonth,
    );

    const revenueThisMonth = Number(row.monthly_revenue ?? 0);
    const revenuePrevMonth = Number(row.prev_month_revenue ?? 0);
    const revenueChange =
      revenuePrevMonth > 0
        ? Math.round(((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100)
        : revenueThisMonth > 0
          ? 100
          : 0;

    return {
      contacts: Number(row.contacts ?? 0),
      conversations: Number(row.conversations ?? 0),
      activeConversations: Number(row.active_conversations ?? 0),
      tasks: Number(row.tasks ?? 0),
      pendingTasks: Number(row.pending_tasks ?? 0),
      documents: Number(row.documents ?? 0),
      documentStorageBytes: Number(row.total_document_bytes ?? 0),
      automations: Number(row.automations ?? 0),
      members: Number(row.members ?? 0),
      monthly_revenue: revenueThisMonth,
      prev_month_revenue: revenuePrevMonth,
      revenue_change_pct: Math.round(revenueChange),
    };
  }

  // ── GET /workspaces/current/stats/today ────────────────────────────────────

  async getTodayStats(workspaceId: string) {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [new_conversations, received_messages, created_tasks, uploaded_documents, unanswered_conversations] =
      await Promise.all([
        this.prisma.conversation.count({
          where: { workspace_id: workspaceId, created_at: { gte: startOfToday } },
        }),
        this.prisma.message.count({
          where: {
            workspace_id: workspaceId,
            direction: "INBOUND",
            created_at: { gte: startOfToday },
          },
        }),
        this.prisma.task.count({
          where: { workspace_id: workspaceId, created_at: { gte: startOfToday } },
        }),
        this.prisma.document.count({
          where: { workspace_id: workspaceId, created_at: { gte: startOfToday } },
        }),
        // Conversations where the customer sent messages we haven't replied to yet
        this.prisma.conversation.count({
          where: {
            workspace_id: workspaceId,
            unread_count: { gt: 0 },
            status: { notIn: ["RESOLVED", "ARCHIVED"] },
          },
        }),
      ]);

    return { new_conversations, received_messages, created_tasks, uploaded_documents, unanswered_conversations };
  }

  // ── GET /workspaces/current/export ────────────────────────────────────────

  async exportData(workspaceId: string, type: string) {
    if (type === "contacts") {
      return this.prisma.contact.findMany({
        where: { workspace_id: workspaceId },
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
          type: true,
          company_name: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      });
    }
    if (type === "tasks") {
      return this.prisma.task.findMany({
        where: { workspace_id: workspaceId },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          due_at: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      });
    }
    if (type === "conversations") {
      return this.prisma.conversation.findMany({
        where: { workspace_id: workspaceId },
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          category: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      });
    }
    throw new BadRequestException(`Invalid export type. Use: contacts | tasks | conversations`);
  }

  // ── POST /workspaces/current/data-export ──────────────────────────────────
  // Full workspace data export: gzip-compressed JSON, uploaded to S3.
  // Rate-limited to 1 export per 24 hours per workspace.

  async requestDataExport(workspaceId: string, requestingUser: AuthUser): Promise<{ download_url: string; expires_at: string }> {
    // Rate limit: 1 export / 24h — stored in workspace settings_json
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true, settings_json: true },
    });
    const settings = (workspace.settings_json as Record<string, any>) ?? {};
    const lastExport: string | undefined = settings.last_data_export_at;
    if (lastExport) {
      const elapsedMs = Date.now() - new Date(lastExport).getTime();
      const remainingH = Math.ceil((24 * 3600_000 - elapsedMs) / 3_600_000);
      if (elapsedMs < 24 * 3600_000) {
        throw new TooManyRequestsException(
          `Ya existe un export reciente. Próximo disponible en ${remainingH}h.`,
        );
      }
    }

    // Collect data — all queries scoped to workspaceId (tenant isolation guaranteed)
    const [contacts, conversations, tasks, documents, members] = await Promise.all([
      this.prisma.contact.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, full_name: true, email: true, phone: true, type: true, company_name: true, created_at: true },
      }),
      this.prisma.conversation.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, subject: true, status: true, priority: true, category: true, created_at: true, resolved_at: true },
      }),
      this.prisma.task.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, title: true, status: true, priority: true, due_at: true, created_at: true, completed_at: true },
      }),
      this.prisma.document.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, file_name: true, mime_type: true, file_size: true, created_at: true },
      }),
      this.prisma.workspaceUser.findMany({
        where: { workspace_id: workspaceId },
        select: { user_id: true, role: true, is_owner: true, created_at: true, user: { select: { email: true, name: true } } },
      }),
    ]);

    const exportPayload = {
      workspace: { id: workspaceId, name: workspace.name },
      exported_at: new Date().toISOString(),
      exported_by: requestingUser.email,
      data: { contacts, conversations, tasks, documents, members },
    };

    const jsonBuf = Buffer.from(JSON.stringify(exportPayload, null, 2));
    const compressed = await gzipAsync(jsonBuf);

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const storageKey = `exports/${workspaceId}/${ts}.json.gz`;
    await this.storage.upload(storageKey, compressed, "application/gzip");

    const PRESIGN_SECONDS = 48 * 3600;
    const downloadUrl = await this.storage.getPresignedUrl(storageKey, PRESIGN_SECONDS);
    const expiresAt = new Date(Date.now() + PRESIGN_SECONDS * 1000).toISOString();

    // Mark last export time for rate limiting
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings_json: { ...settings, last_data_export_at: new Date().toISOString() } },
    });

    // Audit log
    void this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: "workspace.data_export",
      entity_type: "Workspace",
      entity_id: workspaceId,
    });

    // In-app bell notification (non-blocking)
    this.events.emitNotification(requestingUser.id, {
      type: "data_export_ready",
      title: "Export de datos listo",
      body: "Tu export de datos está disponible para descarga (válido 48 horas).",
      action_url: downloadUrl,
    });

    return { download_url: downloadUrl, expires_at: expiresAt };
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
      orderBy: { created_at: "asc" },
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

  async inviteUser(workspaceId: string, requestingUser: AuthUser, dto: InviteUserDto) {
    const canInvite = ["ADMIN", "OWNER", "MANAGER"].includes(requestingUser.role);
    if (!canInvite) {
      throw new ForbiddenException("Solo ADMIN, MANAGER u OWNER pueden invitar usuarios.");
    }

    // MANAGER solo puede invitar roles iguales o inferiores a AGENT
    const managerAllowedRoles = ["AGENT", "BILLING", "VIEWER"];
    if (requestingUser.role === "MANAGER" && !managerAllowedRoles.includes(dto.role)) {
      throw new ForbiddenException("MANAGER solo puede invitar con rol AGENT, BILLING o VIEWER.");
    }

    // No se puede invitar OWNERs adicionales
    if (dto.role === "OWNER") {
      throw new BadRequestException(
        "No se puede invitar con rol OWNER. Transfiere la propiedad explícitamente.",
      );
    }

    await this.planLimits.checkUserLimit(workspaceId);

    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Crear usuario en estado INVITED — recibirá email para setear contraseña
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.email.split("@")[0],
          status: "INVITED",
        },
      });
    }

    const existing = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: user.id },
      },
    });
    if (existing) {
      throw new ConflictException("El usuario ya es miembro de este workspace.");
    }

    const membership = await this.prisma.workspaceUser.create({
      data: {
        workspace_id: workspaceId,
        user_id: user.id,
        role: dto.role,
        is_owner: false,
      },
    });

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true },
    });

    const inviteToken = this.jwtService.sign(
      {
        type: "workspace-invite",
        email: user.email,
        workspace_id: workspace.id,
        workspace_slug: workspace.slug,
      },
      { expiresIn: "7d" },
    );

    const desktopUrl = `PymesHub://accept-invite?token=${encodeURIComponent(inviteToken)}`;
    const browserUrl = `https://pymeshub.lat/accept-invite?token=${encodeURIComponent(inviteToken)}`;

    await this.sendInviteEmail({
      workspaceId,
      to: user.email,
      workspaceName: workspace.name,
      role: dto.role,
      desktopUrl,
      browserUrl,
    });

    await this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: "member.invited",
      entity_type: "workspace_user",
      entity_id: membership.id,
      after: { email: dto.email, role: dto.role },
    });

    return {
      message: `Invitación enviada a ${dto.email}`,
      membership_id: membership.id,
      invite_links: {
        desktop: desktopUrl,
        browser: browserUrl,
      },
    };
  }

  private async sendInviteEmail(params: {
    workspaceId: string;
    to: string;
    workspaceName: string;
    role: string;
    desktopUrl: string;
    browserUrl: string;
  }) {
    const channel = await this.prisma.channel.findFirst({
      where: {
        workspace_id: params.workspaceId,
        type: "EMAIL",
        status: "ACTIVE",
      },
    });

    if (!channel) {
      this.logger.warn(
        `Invitación generada para ${params.to} pero no hay canal EMAIL activo en workspace ${params.workspaceId}.`,
      );
      return;
    }

    const subject = `Te invitaron a ${params.workspaceName} en PymesHub`;
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin-bottom: 12px;">Invitación a ${params.workspaceName}</h2>
        <p>Te agregaron al workspace con rol <strong>${params.role}</strong>.</p>
        <p>Si ya tienes la app de escritorio, ábrela desde aquí:</p>
        <p><a href="${params.desktopUrl}">Abrir en la app</a></p>
        <p>Si no, usa el navegador:</p>
        <p><a href="${params.browserUrl}">Abrir en navegador</a></p>
        <p style="margin-top: 20px; color: #6b7280;">Este enlace vence en 7 días.</p>
      </div>
    `.trim();
    const bodyText = [
      `Te invitaron a ${params.workspaceName} en PymesHub.`,
      `Rol: ${params.role}`,
      `Abrir en la app: ${params.desktopUrl}`,
      `Abrir en navegador: ${params.browserUrl}`,
      "Este enlace vence en 7 días.",
    ].join("\n");

    await this.emailService.sendOutbound(channel, params.to, subject, bodyHtml, bodyText);
  }

  // ── PATCH /workspaces/current/members/:userId/role ────────────────────────

  async changeMemberRole(
    workspaceId: string,
    requestingUser: AuthUser,
    targetUserId: string,
    dto: ChangeMemberRoleDto,
  ) {
    const canChangeRoles = ["ADMIN", "OWNER", "MANAGER"].includes(requestingUser.role);
    if (!canChangeRoles) {
      throw new ForbiddenException("Sin permisos para cambiar roles.");
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });
    if (!membership) throw new NotFoundException("Miembro no encontrado.");

    if (membership.is_owner) {
      throw new ForbiddenException(
        "No se puede cambiar el rol del owner. Transfiere la propiedad primero.",
      );
    }

    if (dto.role === "OWNER") {
      throw new BadRequestException("Usa la ruta de transferencia de propiedad.");
    }

    // MANAGER solo puede asignar roles iguales o inferiores a AGENT
    const managerAllowedRoles = ["AGENT", "BILLING", "VIEWER"];
    if (requestingUser.role === "MANAGER") {
      if (!managerAllowedRoles.includes(dto.role) || !managerAllowedRoles.includes(membership.role)) {
        throw new ForbiddenException("MANAGER solo puede cambiar roles entre AGENT, BILLING y VIEWER.");
      }
    }

    const updated = await this.prisma.workspaceUser.update({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
      data: { role: dto.role },
    });

    await this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: "member.role_changed",
      entity_type: "workspace_user",
      entity_id: membership.id,
      before: { role: membership.role },
      after: { role: dto.role },
    });

    return updated;
  }

  // ── DELETE /workspaces/current/members/:userId ────────────────────────────

  async removeMember(workspaceId: string, requestingUser: AuthUser, targetUserId: string) {
    if (targetUserId === requestingUser.id) {
      throw new BadRequestException("No puedes removerte a ti mismo.");
    }

    if (!["ADMIN", "OWNER", "MANAGER"].includes(requestingUser.role)) {
      throw new ForbiddenException("Sin permisos para remover miembros.");
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });
    if (!membership) throw new NotFoundException("Miembro no encontrado.");
    if (membership.is_owner) {
      throw new ForbiddenException("No se puede remover al owner.");
    }

    await this.prisma.workspaceUser.delete({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });

    await this.audit.log(workspaceId, {
      user_id: requestingUser.id,
      action: "member.removed",
      entity_type: "workspace_user",
      entity_id: membership.id,
      before: { user_id: targetUserId, role: membership.role },
    });

    return { message: "Miembro removido del workspace." };
  }

  // ── Quick Start progress tracking ─────────────────────────────────────────

  /**
   * Mark a quick-start checklist step as completed in workspace settings_json.
   * Idempotent — if already true, does nothing.
   */
  async markQuickStartStep(workspaceId: string, step: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    if (!ws) return;

    const settings: Record<string, any> =
      ws.settings_json && typeof ws.settings_json === "object"
        ? (ws.settings_json as Record<string, any>)
        : {};

    const current = settings.quick_start_progress || {};
    if (current[step]) return; // already done

    settings.quick_start_progress = { ...current, [step]: true };

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings_json: settings },
    });
  }

  async getSetupChecklist(workspaceId: string) {
    const [workspace, channelCount, memberCount, departmentCount, agentCount, templateCount] =
      await Promise.all([
        this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { settings_json: true, created_at: true },
        }),
        this.prisma.channel.count({ where: { workspace_id: workspaceId } }),
        this.prisma.workspaceUser.count({
          where: { workspace_id: workspaceId, role: { not: "OWNER" } },
        }),
        this.prisma.department.count({ where: { workspace_id: workspaceId } }),
        this.prisma.agentInstance.count({
          where: { workspace_id: workspaceId, status: "ACTIVE" },
        }),
        this.prisma.messageTemplate.count({ where: { workspace_id: workspaceId } }),
      ]);

    if (!workspace) return null;

    const settings = (workspace.settings_json as Record<string, any>) ?? {};
    const dismissedAt: string | null = settings.setup_dismissed_at ?? null;

    const items = [
      { key: "channel_connected", label: "Conectar primer canal",        href: "/settings/channels",    required: true,  done: channelCount > 0 },
      { key: "member_invited",    label: "Invitar al menos un miembro",   href: "/settings/members",     required: true,  done: memberCount > 0 },
      { key: "department_created",label: "Configurar departamento",       href: "/settings/departments", required: true,  done: departmentCount > 0 },
      { key: "agent_activated",   label: "Activar agente IA",             href: "/agents",               required: false, done: agentCount > 0 },
      { key: "template_created",  label: "Crear plantilla de respuesta",  href: "/settings/templates",   required: false, done: templateCount > 0 },
    ];

    const completedCount = items.filter((i) => i.done).length;
    const ageMs = Date.now() - new Date(workspace.created_at).getTime();
    const isNew = ageMs < 30 * 24 * 60 * 60 * 1000;
    const shouldShow = !dismissedAt && (isNew || completedCount < 3);

    return { items, dismissed: !!dismissedAt, should_show: shouldShow, completed_count: completedCount };
  }

  async dismissSetupChecklist(workspaceId: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings: Record<string, any> =
      ws?.settings_json && typeof ws.settings_json === "object"
        ? (ws.settings_json as Record<string, any>)
        : {};
    settings.setup_dismissed_at = new Date().toISOString();
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings_json: settings },
    });
  }

  // ── Automation Recipes ──────────────────────────────────────────────────────

  private readonly RECIPE_CATALOG = [
    {
      slug: "welcome-message",
      category: "communication",
      name: "Bienvenida automática",
      description: "Envía un mensaje cuando un cliente inicia una nueva conversación.",
      config_schema: [{ key: "message", label: "Mensaje de bienvenida", type: "textarea", default: "¡Hola! Gracias por contactarnos. En breve te atenderemos." }],
    },
    {
      slug: "out-of-hours",
      category: "communication",
      name: "Mensaje fuera de horario",
      description: "Responde automáticamente cuando llega un mensaje fuera del horario de atención.",
      config_schema: [
        { key: "message", label: "Mensaje fuera de horario", type: "textarea", default: "Gracias por escribirnos. Nuestro horario es de lunes a viernes 8am–6pm. Te responderemos pronto." },
        { key: "start_hour", label: "Inicio de horario (hora)", type: "number", default: "8" },
        { key: "end_hour", label: "Fin de horario (hora)", type: "number", default: "18" },
      ],
    },
    {
      slug: "no-reply-followup",
      category: "communication",
      name: "Seguimiento sin respuesta",
      description: "Envía un recordatorio si el cliente no responde en X horas.",
      config_schema: [
        { key: "hours", label: "Horas sin respuesta", type: "number", default: "24" },
        { key: "message", label: "Mensaje de seguimiento", type: "textarea", default: "Hola, ¿pudiste revisar mi última respuesta? Estamos aquí para ayudarte." },
      ],
    },
    {
      slug: "keyword-assignment",
      category: "operations",
      name: "Asignación por palabra clave",
      description: "Asigna la conversación a un departamento cuando el mensaje contiene ciertas palabras.",
      config_schema: [
        { key: "keywords", label: "Palabras clave (separadas por coma)", type: "text", default: "factura, pago, cobro" },
        { key: "department", label: "Departamento destino", type: "text", default: "" },
      ],
    },
    {
      slug: "unattended-alert",
      category: "operations",
      name: "Alerta de conversación sin atender",
      description: "Notifica al supervisor cuando una conversación lleva más de N minutos sin respuesta.",
      config_schema: [{ key: "minutes", label: "Minutos sin atender", type: "number", default: "30" }],
    },
    {
      slug: "payment-reminder",
      category: "billing",
      name: "Recordatorio de pago",
      description: "Envía un mensaje al cliente cuando su factura está próxima a vencer.",
      config_schema: [{ key: "days_before", label: "Días antes del vencimiento", type: "number", default: "3" }],
    },
    {
      slug: "overdue-team-alert",
      category: "billing",
      name: "Alerta de factura vencida",
      description: "Notifica al equipo de cobranza cuando una factura vence hoy.",
      config_schema: [],
    },
  ] as const;

  async getAutomationRecipes(workspaceId: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings = (ws?.settings_json as Record<string, any>) ?? {};
    const activeRecipes: Record<string, { is_active: boolean; config: Record<string, string> }> =
      settings.automation_recipes ?? {};

    return this.RECIPE_CATALOG.map((recipe) => ({
      ...recipe,
      is_active: activeRecipes[recipe.slug]?.is_active ?? false,
      config: activeRecipes[recipe.slug]?.config ?? {},
    }));
  }

  async toggleAutomationRecipe(workspaceId: string, slug: string, config?: Record<string, string>) {
    const recipe = this.RECIPE_CATALOG.find((r) => r.slug === slug);
    if (!recipe) return { ok: false, error: "Recipe not found" };

    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings: Record<string, any> =
      ws?.settings_json && typeof ws.settings_json === "object"
        ? (ws.settings_json as Record<string, any>)
        : {};
    const current: Record<string, any> = settings.automation_recipes ?? {};
    const existing = current[slug] ?? { is_active: false, config: {} };
    current[slug] = {
      is_active: !existing.is_active,
      config: config ?? existing.config ?? {},
    };
    settings.automation_recipes = current;

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings_json: settings },
    });
    return { ok: true, is_active: current[slug].is_active };
  }

  async updateAutomationRecipeConfig(workspaceId: string, slug: string, config: Record<string, string>) {
    const recipe = this.RECIPE_CATALOG.find((r) => r.slug === slug);
    if (!recipe) return { ok: false, error: "Recipe not found" };

    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings: Record<string, any> =
      ws?.settings_json && typeof ws.settings_json === "object"
        ? (ws.settings_json as Record<string, any>)
        : {};
    const current: Record<string, any> = settings.automation_recipes ?? {};
    current[slug] = { ...(current[slug] ?? {}), config };
    settings.automation_recipes = current;

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings_json: settings },
    });
    return { ok: true };
  }

  async getBusinessProfile(workspaceId: string) {
    return this.prisma.workspaceBusinessProfile.findUnique({
      where: { workspace_id: workspaceId },
    });
  }

  async saveBusinessProfile(
    workspaceId: string,
    dto: { categories: string[]; team_size: string; channels: string[]; needs: string[] },
  ) {
    return this.prisma.workspaceBusinessProfile.upsert({
      where: { workspace_id: workspaceId },
      create: {
        workspace_id: workspaceId,
        categories: dto.categories,
        team_size: dto.team_size,
        channels: dto.channels,
        needs: dto.needs,
        completed_at: new Date(),
      },
      update: {
        categories: dto.categories,
        team_size: dto.team_size,
        channels: dto.channels,
        needs: dto.needs,
        completed_at: new Date(),
      },
    });
  }
}
