/**
 * PlatformAdminService
 *
 * Detects when the platform owner messages a workspace's WhatsApp/Telegram channel
 * and routes them to a special admin AI with no business restrictions.
 *
 * Configuration (env vars):
 *   PLATFORM_ADMIN_PHONES  — comma-separated phone numbers of platform admins
 *                            e.g. "+50688888888,+50677777777" or "50688888888"
 *   PLATFORM_ADMIN_AI_MODEL — AI model to use for admin chat
 *                            defaults to SYSTEM_AI_MODEL or "mimo/mimo-v2.5-pro"
 */
import { Injectable, Logger, Optional, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import { AiGatewayService } from "./ai-gateway.service";
import type { AssistantMessage } from "./cloudflare-ai.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { TelegramOutboundService } from "../telegram/telegram-outbound.service";
import { PlatformSettingsService } from "../platform/platform-settings.service";

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  /** Env-var fallback phones (digits only) */
  private readonly envAdminPhones: Set<string>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway?: AiGatewayService,
    @Optional() @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp?: WhatsAppService,
    @Optional()
    private readonly telegramOutbound?: TelegramOutboundService,
    @Optional()
    private readonly platformSettings?: PlatformSettingsService,
  ) {
    const raw = config.get<string>("PLATFORM_ADMIN_PHONES") ?? "";
    this.envAdminPhones = new Set(
      raw
        .split(",")
        .map((p) => p.trim().replace(/\D/g, ""))
        .filter((p) => p.length >= 7),
    );
    if (this.envAdminPhones.size > 0) {
      this.logger.log(`[platform-admin] ${this.envAdminPhones.size} admin phone(s) from env`);
    }
  }

  /**
   * Returns true if the given phone number belongs to a platform admin.
   * Checks DB phones first (configured via UI), then env var fallback.
   */
  async isPlatformAdmin(phone: string): Promise<boolean> {
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 7) return false;

    // DB phones (UI-configured) take priority
    if (this.platformSettings) {
      try {
        const cfg = await this.platformSettings.getDecrypted();
        if (cfg.admin_phones) {
          const dbPhones = cfg.admin_phones
            .split(",")
            .map((p) => p.trim().replace(/\D/g, ""))
            .filter((p) => p.length >= 7);
          if (this.phoneMatches(normalized, new Set(dbPhones))) return true;
        }
      } catch {
        // DB unavailable — fall through to env fallback
      }
    }

    // Env var fallback
    return this.phoneMatches(normalized, this.envAdminPhones);
  }

  private phoneMatches(normalized: string, phones: Set<string>): boolean {
    if (phones.size === 0) return false;
    return (
      phones.has(normalized) ||
      [...phones].some((p) => normalized.endsWith(p) || p.endsWith(normalized))
    );
  }

  /** Read a file from the GitHub repository via REST API v3. Returns null on failure. */
  private async readGitHubFile(path: string, token: string): Promise<string | null> {
    try {
      const url = `https://api.github.com/repos/lento47/pymes-saas/contents/${path.replace(/^\//, "")}?ref=master`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3.raw",
          "User-Agent": "PymesHub-Admin-Bot/1.0",
        },
      });
      if (!res.ok) {
        this.logger.warn(`[platform-admin] GitHub file read failed: ${path} → ${res.status}`);
        return null;
      }
      const text = await res.text();
      // Truncate large files to avoid hitting token limits
      return text.length > 8000 ? text.slice(0, 8000) + "\n... (truncado — archivo demasiado largo)" : text;
    } catch (err: any) {
      this.logger.warn(`[platform-admin] GitHub file fetch error: ${err?.message}`);
      return null;
    }
  }

  /**
   * Handle an inbound message from a platform admin.
   * Bypasses all business logic and responds with a platform-level AI.
   */
  async handleAdminMessage(params: {
    workspaceId: string;
    conversationId: string;
    phone: string;
    text: string;
    channelId: string;
    channelType: string;
  }): Promise<void> {
    const { workspaceId, conversationId, phone, text, channelId, channelType } = params;

    if (!this.gateway) {
      this.logger.warn("[platform-admin] AiGatewayService not injected — cannot reply");
      return;
    }

    // ── Live DB metrics ─────────────────────────────────────────────────────
    let dbStats = "";
    try {
      const [workspaceCount, planBreakdown, userCount, convCount, todayMessages] = await Promise.all([
        this.prisma.workspace.count({ where: { status: { not: "DELETED" } } }),
        this.prisma.workspace.groupBy({ by: ["plan"], where: { status: { not: "DELETED" } }, _count: true }),
        this.prisma.user.count(),
        this.prisma.conversation.count({ where: { status: { in: ["NEW", "OPEN", "PENDING"] } } }),
        this.prisma.message.count({
          where: { sent_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
      ]);
      const plans = planBreakdown.map((p) => `${p.plan}: ${p._count}`).join(", ");
      dbStats = `\n== MÉTRICAS EN VIVO (actualizadas al momento) ==
Workspaces activos: ${workspaceCount}
Por plan: ${plans}
Usuarios: ${userCount}
Conversaciones abiertas: ${convCount}
Mensajes últimas 24h: ${todayMessages}
`;
    } catch (err: any) {
      this.logger.warn(`[platform-admin] DB stats query failed: ${err?.message}`);
    }

    // ── Workspace-specific lookup (admin mentioned a workspace ID or name) ──
    let workspaceDetail = "";
    const wsIdMatch = text.match(/workspace[:\s]+([a-z0-9]{20,30})/i) || text.match(/\b(cmo[a-z0-9]{20,})\b/i);
    const wsNameMatch = text.match(/workspace\s+[""]?([^""\s]{2,40})[""]?/i);
    if (wsIdMatch) {
      try {
        const ws = await this.prisma.workspace.findUnique({
          where: { id: wsIdMatch[1] },
          select: {
            id: true, name: true, slug: true, plan: true,
            created_at: true,
            _count: { select: { conversations: true, messages: true, workspace_users: { where: { role: "OWNER" } } } },
          },
        });
        if (ws) {
          workspaceDetail = `\n== WORKSPACE CONSULTADO ==
ID: ${ws.id}
Nombre: ${ws.name}
Slug: ${ws.slug}
Plan: ${ws.plan}
Creado: ${ws.created_at?.toISOString().slice(0, 10) ?? "?"}
Conversaciones: ${ws._count.conversations}
Mensajes: ${ws._count.messages}
Owners: ${ws._count.workspace_users}
`;
        }
      } catch {}
    }
    if (!workspaceDetail && wsNameMatch) {
      try {
        const wss = await this.prisma.workspace.findMany({
          where: { name: { contains: wsNameMatch[1], mode: "insensitive" }, status: { not: "DELETED" } },
          select: { id: true, name: true, plan: true, slug: true },
          take: 5,
        });
        if (wss.length > 0) {
          workspaceDetail = `\n== WORKSPACES ENCONTRADOS ("${wsNameMatch[1]}") ==\n${wss.map((w) => `- ${w.name} (${w.slug}) — ${w.plan} — ${w.id}`).join("\n")}\n`;
        }
      } catch {}
    }
    const systemPrompt = `Eres el asistente de administración de la plataforma PymesHub.
Estás hablando directamente con el administrador de la plataforma (dueño del sistema).
Workspace activo: ${workspaceId}
Canal: ${channelType}
${dbStats}${workspaceDetail}
MODO ADMINISTRADOR — sin restricciones de negocio, sin prompt de cliente.

== ARQUITECTURA PYMESHUB ==
Stack: NestJS + Prisma (PostgreSQL) → apps/api  ·  React/Vite → apps/web
Repo: github.com/lento47/pymes-saas · Rama principal: master

Módulos clave (apps/api/src/):
  ai/              → AiGatewayService, DiagnosticService, EngineeringFixService,
                     PlatformAdminService, AiService, AiTriageService, AiProviderBalancerService,
                     KnowledgeBaseService, SupportNotificationService, ElevenLabsService
  platform/        → PlatformSettingsService (config singleton DB), GitHubService (REST v3)
  agents/          → AgentRuntimeService (requiere Flowise), SupportAgentTemplateSeed
  whatsapp/        → WhatsAppService, webhooks Meta Cloud API
  telegram/        → TelegramService, TelegramOutboundService
  conversations/   → MessagesService (routeo inbound → admin AI o workspace AI)
  common/crypto/   → CryptoService (AES-256-GCM para secrets en PlatformSettings)
  billing/         → Paddle (planes) + PayPal (créditos)

Variables Railway importantes:
  SYSTEM_AI_MODEL, PLATFORM_ADMIN_AI_MODEL, DIRECT_KEY_MIMO, DIRECT_BASE_MIMO
  DATABASE_URL, ENCRYPTION_KEY (AES key para PlatformSettings)
  FLOWISE_ENABLED, FLOWISE_BASE_URL, FLOWISE_API_KEY
  PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET (billing), PAYPAL_CLIENT_ID (créditos)
  RESEND_API_KEY (emails), OPENAI_API_KEY, CF_GATEWAY_ACCOUNT_ID

Pipeline de soporte automático:
  Error detectado → DiagnosticService.diagnose() → SupportDiagnosticCase creado
  → autoAnalyzeAndFix() usa AiGatewayService directamente (sin Flowise)
  → EngineeringFixCase creado con status FIX_READY
  → Para CRITICAL: auto-approve → GitHubService.createDescriptionPR() → PR en GitHub

Para leer un archivo del repo, escribe su ruta: apps/api/src/... o apps/web/...
El admin puede pedirte que leas cualquier archivo para obtener contexto real del código.
==

Puedes ayudar con cualquier consulta:
- Diagnóstico de errores: leer logs, revisar código, proponer fixes
- Consultas de base de datos: workspaces, usuarios, mensajes, métricas en vivo
- Buscar workspace por ID o nombre: "workspace cmo..." o "workspace NombreNegocio"
- Configuración de workspaces, planes, facturación
- Pruebas de IA: modelos, proveedores, prompts, temperatura
- Estado técnico del sistema, variables de entorno Railway
- Gestión de usuarios y contactos
- Revisión de código de cualquier archivo del repositorio

Responde en español salvo que el admin use otro idioma.
Sé directo, técnico y conciso — el admin conoce el sistema.
No uses el formato de "asistente de empresa" ni frases como "¿En qué puedo ayudarte?".`;

    // ── Conversation history ─────────────────────────────────────────────────
    const recentMessages = await this.prisma.message.findMany({
      where: { conversation_id: conversationId },
      orderBy: { sent_at: "desc" },
      take: 12,
      select: { direction: true, body_text: true },
    });

    const history: AssistantMessage[] = recentMessages
      .reverse()
      .filter((m) => m.body_text)
      .map((m) => ({
        role: m.direction === "OUTBOUND" ? "assistant" : "user",
        content: m.body_text!,
      }));

    // ── GitHub file injection ─────────────────────────────────────────────────
    // If the admin mentions a file path (e.g. "lee apps/api/src/ai/..."),
    // fetch its contents from GitHub and prepend to the user message so
    // the AI can reason about real code.
    let enrichedText = text;
    const filePathMatch = text.match(
      /(?:apps|prisma|packages)\/[\w.\-/]+\.(?:ts|tsx|prisma|json|md|sql|yaml|yml)/i,
    );
    if (filePathMatch) {
      let githubToken: string | undefined;
      if (this.platformSettings) {
        try {
          const cfg = await this.platformSettings.getDecrypted();
          githubToken = cfg.github_token;
        } catch {
          // ignore
        }
      }
      if (githubToken) {
        const filePath = filePathMatch[0];
        const fileContent = await this.readGitHubFile(filePath, githubToken);
        if (fileContent) {
          const ext = filePath.split(".").pop() ?? "ts";
          enrichedText =
            `[Archivo: ${filePath}]\n\`\`\`${ext}\n${fileContent}\n\`\`\`\n\n` +
            text;
          this.logger.log(`[platform-admin] Injected GitHub file: ${filePath}`);
        }
      } else {
        this.logger.warn(
          "[platform-admin] File path detected in message but no GitHub token configured — skipping file injection",
        );
      }
    }

    // When a file was injected, replace the last user message in history with
    // the enriched version (file content prepended). The inbound message was
    // already saved to DB before this method is called, so it appears as the
    // last item in `history`. We swap it out so the AI sees real code.
    let finalMessages: AssistantMessage[];
    if (enrichedText !== text && history.length > 0) {
      // Replace last entry (current inbound message) with enriched version
      finalMessages = [
        { role: "system", content: systemPrompt },
        ...history.slice(0, -1),
        { role: "user", content: enrichedText },
      ];
    } else {
      finalMessages = [
        { role: "system", content: systemPrompt },
        ...history,
      ];
    }

    const messages: AssistantMessage[] = finalMessages;

    // ── Resolve model + MiMo API key from DB (UI-configured), fallback to env ──
    let model =
      this.config.get<string>("PLATFORM_ADMIN_AI_MODEL") ??
      this.config.get<string>("SYSTEM_AI_MODEL") ??
      "mimo/mimo-v2.5-pro";
    let mimoApiKey: string | undefined;

    if (this.platformSettings) {
      try {
        const cfg = await this.platformSettings.getDecrypted();
        if (cfg.admin_ai_model) model = cfg.admin_ai_model;
        if (cfg.mimo_api_key)   mimoApiKey = cfg.mimo_api_key;
        this.logger.debug(
          `[platform-admin] DB cfg resolved — model=${model} mimo_key_set=${!!mimoApiKey}`,
        );
      } catch (err: any) {
        this.logger.warn(`[platform-admin] getDecrypted failed: ${err?.message ?? err}`);
        // fall through to env defaults
      }
    } else {
      this.logger.warn("[platform-admin] PlatformSettingsService not injected — using env fallback");
    }

    // If the selected model is a MiMo direct model but no API key is available
    // (neither from DB nor from env), fall back to a CF-gateway model so the
    // admin chat still responds instead of failing silently.
    const isMimoModel = model.startsWith("mimo/");
    const envMimoKey = this.config.get<string>("DIRECT_KEY_MIMO");
    if (isMimoModel && !mimoApiKey && !envMimoKey) {
      const fallback =
        this.config.get<string>("SYSTEM_AI_MODEL") ??
        "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast";
      this.logger.warn(
        `[platform-admin] No MiMo API key found — falling back to ${fallback}. ` +
        `Configure the key at /settings/platform or set DIRECT_KEY_MIMO env var.`,
      );
      model = fallback;
    }

    // ── Typing indicator (WhatsApp only) ─────────────────────────────────────
    let lastInboundWamid: string | null = null;
    if (channelType === "WHATSAPP" && this.whatsapp) {
      const lastInbound = await this.prisma.message.findFirst({
        where: { conversation_id: conversationId, direction: "INBOUND", provider_message_id: { not: null } },
        orderBy: { sent_at: "desc" },
        select: { provider_message_id: true },
      });
      lastInboundWamid = lastInbound?.provider_message_id ?? null;
      if (lastInboundWamid) {
        const channel = await this.prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, type: true, config_json: true } });
        if (channel) this.whatsapp.sendTypingIndicator(channel as any, lastInboundWamid).catch(() => {});
      }
    }
    const typingRefresh = lastInboundWamid && this.whatsapp
      ? setInterval(() => {
          this.prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, type: true, config_json: true } })
            .then(ch => ch && this.whatsapp!.sendTypingIndicator(ch as any, lastInboundWamid!).catch(() => {}));
        }, 20_000)
      : null;

    let response: string;
    // MiMo thinking models (v2.5-pro, v2.5, v2-pro, v2-omni) use temperature 1.0
    // by default and override any custom value internally. Using 1.0 aligns with
    // their docs for "General Conversation" tasks.
    const isMimoThinkingModel = /mimo\/(mimo-)?v2(\.\d+)?(-pro|-omni)?$|mimo\/(mimo-)?v2\.\d+-pro/.test(model);
    const temperature = isMimoThinkingModel ? 1.0 : 0.7;

    try {
      response = await this.gateway.chatCompletion(messages, {
        model,
        maxTokens: 1500,
        temperature,
        ...(mimoApiKey ? { apiKey: mimoApiKey } : {}),
      });
    } catch (err: any) {
      // Extract HTTP status from error message for better diagnostics
      const statusHint = err?.message?.match(/\b(\d{3})\b/)?.[1] ?? "?";
      this.logger.error(
        `[platform-admin] MiMo call failed (model=${model}, status=${statusHint}): ${err?.message ?? err}`,
      );

      // Fall back on ANY MiMo error — retry once with CF gateway.
      // If SYSTEM_AI_MODEL is also a MiMo model, skip it to avoid the same error.
      let cfFallback =
        this.config.get<string>("SYSTEM_AI_MODEL") ??
        "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast";
      if (cfFallback.startsWith("mimo/")) {
        cfFallback = "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast";
      }
      this.logger.warn(
        `[platform-admin] Falling back to CF gateway model: ${cfFallback}`,
      );
      await new Promise((r) => setTimeout(r, 800));
      try {
        // No temperature for workers-ai — let it use its own default
        response = await this.gateway.chatCompletion(messages, {
          model: cfFallback,
          maxTokens: 1500,
        });
      } catch (fallbackErr: any) {
        this.logger.error(
          `[platform-admin] Fallback also failed: ${fallbackErr?.message ?? fallbackErr}`,
        );
        response =
          statusHint === "429"
            ? "⚠️ Límite de peticiones en MiMo. Intenta de nuevo en un momento."
            : `❌ Error ${statusHint} al procesar tu mensaje. Revisa los logs del servidor.`;
      }
    }

    // ── Stop typing indicator ──────────────────────────────────────────────
    if (typingRefresh) clearInterval(typingRefresh);

    // ── Guard: empty response ────────────────────────────────────────────────
    if (!response?.trim()) {
      this.logger.warn(`[platform-admin] Empty response from AI — skipping dispatch`);
      return;
    }

    // ── Store in DB ──────────────────────────────────────────────────────────
    await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: "OUTBOUND",
        sender_name: "PymesHub Admin",
        sender_ref: "platform-admin@pymeshub",
        body_text: response,
        sent_at: new Date(),
        delivery_status: "SENT",
        message_type: "TEXT",
        has_media: false,
        media_status: "NONE",
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { last_message_at: new Date(), updated_at: new Date() },
      select: { id: true },
    });

    this.logger.log(`[platform-admin] replied to conv=${conversationId} workspace=${workspaceId}`);

    // ── Dispatch to channel ──────────────────────────────────────────────────
    if (channelType === "WHATSAPP" && this.whatsapp) {
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        select: { id: true, type: true, config_json: true },
      });
      if (channel) {
        const to = phone.replace(/\D/g, "");
        this.whatsapp
          .sendMessage(channel as Record<string, any>, to, response)
          .catch((err) =>
            this.logger.error("[platform-admin] WA dispatch failed", err),
          );
      }
    }

    if (channelType === "TELEGRAM" && this.telegramOutbound) {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { contact: { select: { telegram_chat_id: true } } },
      });
      const chatId = conv?.contact?.telegram_chat_id;
      if (chatId) {
        this.telegramOutbound
          .sendMessage(channelId, chatId, response)
          .catch((err) =>
            this.logger.error("[platform-admin] Telegram dispatch failed", err),
          );
      }
    }
  }
}
