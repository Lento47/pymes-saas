import { randomBytes } from "crypto";
import { ConversationStatus } from "@prisma/client";
import type { RunbookDescriptor, RunbookExecutor, RunbookExecutionContext } from "./runbooks.types";

/**
 * Registry of all runbooks. Each entry has a descriptor (shown to the
 * support agent in the catalog) and an executor (the actual logic).
 *
 * Adding a new runbook:
 *   1. Push a new entry below.
 *   2. Keep the executor pure — it should only depend on `ctx.prisma`
 *      and other services exposed through `ctx`. No filesystem, no
 *      network calls without explicit allowlist, no shelling out.
 *   3. The executor's return value is stored verbatim in
 *      `runbook_executions.result_json`. Don't return secrets there.
 */

interface RunbookEntry {
  descriptor: RunbookDescriptor;
  execute: RunbookExecutor;
}

// ──────────────────────────────────────────────────────────────────────
// 1. revoke-user-sessions — invalidates all refresh tokens for a user.
//    Use when a token has been leaked or after offboarding to terminate
//    every active session immediately. Reversal: the user logs in again.
// ──────────────────────────────────────────────────────────────────────

const revokeUserSessions: RunbookEntry = {
  descriptor: {
    name: "revoke-user-sessions",
    title: "Revocar sesiones de un usuario",
    description:
      "Invalida todos los refresh tokens del usuario en este workspace. " +
      "Las sesiones activas siguen funcionando hasta que su access token expire " +
      "(15-30 minutos), después no se pueden renovar.",
    reversalNotes:
      "No-op irreversible per se: el usuario simplemente vuelve a iniciar sesión. " +
      "No hay efecto colateral en datos del workspace.",
    parameters: [
      {
        key: "user_id",
        label: "ID del usuario",
        description: "ID interno del User cuyas sesiones se invalidan.",
        type: "uuid",
        required: true,
      },
    ],
    risk: "low",
    requiredScope: "platform_admin",
  },
  async execute(ctx: RunbookExecutionContext) {
    const userId = ctx.params.user_id;

    // Verify the user has at least one membership in the target workspace
    // before we revoke. Without this check a platform admin could revoke
    // sessions for a user from another workspace by mistake.
    const membership = await ctx.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: ctx.workspaceId, user_id: userId },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new Error(`User ${userId} is not a member of workspace ${ctx.workspaceId}`);
    }

    const result = await ctx.prisma.refreshToken.updateMany({
      where: {
        user_id: userId,
        workspace_id: ctx.workspaceId,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });

    return {
      summary: `Revocados ${result.count} refresh token(s) para el usuario.`,
      details: { user_id: userId, revoked_count: result.count },
    };
  },
};

// ──────────────────────────────────────────────────────────────────────
// 2. mark-conversation-resolved — emergency close on a stuck conversation.
//    Use when a conversation cannot be closed through the normal UI
//    (e.g. the assigned agent is offline and the SLA timer is expiring).
//    Reversal: re-open the conversation from the inbox UI.
// ──────────────────────────────────────────────────────────────────────

const markConversationResolved: RunbookEntry = {
  descriptor: {
    name: "mark-conversation-resolved",
    title: "Forzar cierre de conversación",
    description:
      "Marca una conversación como RESOLVED. " +
      "Útil cuando la UI normal no permite cerrarla (agente offline, SLA al límite).",
    reversalNotes:
      "Reversible desde la UI: abrir la conversación y reabrirla. " +
      "No borra mensajes ni datos asociados.",
    parameters: [
      {
        key: "conversation_id",
        label: "ID de la conversación",
        type: "uuid",
        required: true,
      },
      {
        key: "reason",
        label: "Razón del cierre",
        description: "Texto que se guarda en la conversación para auditoría.",
        type: "string",
        required: true,
      },
    ],
    risk: "medium",
    requiredScope: "platform_admin",
  },
  async execute(ctx: RunbookExecutionContext) {
    const conversationId = ctx.params.conversation_id;
    const reason = ctx.params.reason || "(sin razón especificada)";

    const conv = await ctx.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: ctx.workspaceId },
      select: { id: true, status: true },
    });
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found in workspace ${ctx.workspaceId}`);
    }
    if (conv.status === ConversationStatus.RESOLVED) {
      return {
        summary: "La conversación ya estaba cerrada — no se hicieron cambios.",
        details: { conversation_id: conversationId, no_op: true },
      };
    }

    await ctx.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.RESOLVED,
        resolved_at: new Date(),
      },
    });

    // Audit trail of the reason lives in `runbook_executions.parameters_json`
    // — the service persists params on every execution. No need to also
    // dump it on the Conversation row (which has no internal_notes field).
    return {
      summary: "Conversación marcada como RESOLVED.",
      details: {
        conversation_id: conversationId,
        previous_status: conv.status,
        reason,
      },
    };
  },
};

// ──────────────────────────────────────────────────────────────────────
// 3. rotate-channel-webhook-secret — generates a new webhook secret for
//    a channel and persists it in `channel.config_json.webhook_secret`.
//    Note: this only rotates the LOCAL secret. For Telegram, the new
//    secret won't take effect until someone calls
//    POST /inbound/telegram/{channelId}/register-webhook from the UI.
//    The runbook intentionally stops short of triggering external API
//    calls — that's a separate, larger blast-radius operation.
// ──────────────────────────────────────────────────────────────────────

const rotateChannelWebhookSecret: RunbookEntry = {
  descriptor: {
    name: "rotate-channel-webhook-secret",
    title: "Rotar secret de webhook de canal",
    description:
      "Genera un nuevo webhook_secret para el canal y lo guarda en config_json. " +
      "Útil si el secret se filtró o el canal está rechazando inbounds. " +
      'Para Telegram, ejecutar después "Re-registrar webhook" desde Configuración → Canales.',
    reversalNotes:
      "Irreversible: el secret anterior se sobrescribe. Si no se re-registra " +
      "el webhook con el proveedor, el canal puede quedar sin recibir mensajes.",
    parameters: [
      {
        key: "channel_id",
        label: "ID del canal",
        type: "uuid",
        required: true,
      },
    ],
    risk: "high",
    requiredScope: "platform_admin",
  },
  async execute(ctx: RunbookExecutionContext) {
    const channelId = ctx.params.channel_id;

    const channel = await ctx.prisma.channel.findFirst({
      where: { id: channelId, workspace_id: ctx.workspaceId },
      select: { id: true, type: true, config_json: true },
    });
    if (!channel) {
      throw new Error(`Channel ${channelId} not found in workspace ${ctx.workspaceId}`);
    }

    const newSecret = randomBytes(32).toString("hex");
    const existing = (channel.config_json as Record<string, unknown> | null) ?? {};
    const next = { ...existing, webhook_secret: newSecret };

    await ctx.prisma.channel.update({
      where: { id: channelId },
      data: { config_json: next as any },
    });

    return {
      summary:
        `Nuevo webhook_secret generado para canal ${channel.type}. ` +
        "Re-registrar webhook con el proveedor para aplicarlo.",
      details: {
        channel_id: channelId,
        channel_type: channel.type,
        // Don't return the raw secret — store-only via config_json.
        secret_rotated: true,
      },
    };
  },
};

// ──────────────────────────────────────────────────────────────────────

export const RUNBOOK_REGISTRY: Record<string, RunbookEntry> = {
  [revokeUserSessions.descriptor.name]: revokeUserSessions,
  [markConversationResolved.descriptor.name]: markConversationResolved,
  [rotateChannelWebhookSecret.descriptor.name]: rotateChannelWebhookSecret,
};

export const RUNBOOK_DESCRIPTORS: RunbookDescriptor[] = Object.values(RUNBOOK_REGISTRY).map(
  (entry) => entry.descriptor,
);
