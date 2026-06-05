import { forwardRef, Inject, Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../common/prisma/prisma.service";

// Lazy-load to avoid circular dependency
type CallsServiceType = {
  handleDisconnect(userId: string): Promise<void>;
};

// ─── Eventos emitidos al cliente ─────────────────────────────────────────────
// message:new          → nuevo mensaje en una conversación (DTO enriquecido)
// message:status       → cambio de estado de entrega de un mensaje
// message:media-ready  → media descargada y almacenada, actualizar UI
// conversation:updated → cambio de estado/prioridad/asignación
// notification:new     → nueva notificación para el usuario
// task:updated         → tarea actualizada
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve WebSocket CORS origins, defaulting to '*' in production since JWT auth is required. */
function resolveCorsOrigins(): string | string[] {
  const env = process.env.CORS_ORIGIN;
  if (env) return env.split(",").map((o) => o.trim()).filter(Boolean);
  if (process.env.NODE_ENV === "production") return "*";
  return [
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
}

@WebSocketGateway({
  cors: {
    origin: resolveCorsOrigins(),
    credentials: true,
  },
  namespace: "/ws",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private callsService: CallsServiceType | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Inject CallsService lazily to avoid circular dependency.
   * Called from AppModule after all modules are initialized.
   */
  setCallsService(service: CallsServiceType) {
    this.callsService = service;
  }

  // ── Conexión ───────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        ((client.handshake.auth as Record<string, unknown>)?.token as string | undefined) ||
        client.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) throw new Error("No token");

      const payload = this.jwtService.verify<{
        sub: string;
        workspace_id: string;
        email: string;
        role: string;
      }>(token);

      // Guardar contexto en el socket
      client.data.userId = payload.sub;
      client.data.workspaceId = payload.workspace_id;
      client.data.role = payload.role;

      // Unirse a rooms automáticas
      await client.join(`workspace:${payload.workspace_id}`);
      await client.join(`user:${payload.sub}`);

      this.logger.log(`Connected: ${payload.email} (workspace:${payload.workspace_id})`);
    } catch {
      this.logger.warn(`Rejected connection: ${client.id} — invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (userId && this.callsService) {
      this.callsService.handleDisconnect(userId).catch((err) =>
        this.logger.error(`Call cleanup failed for ${userId}: ${(err as Error)?.message ?? err}`),
      );
    }
    this.logger.log(`Disconnected: ${client.id}`);
  }

  // ── Eventos del cliente ────────────────────────────────────────────────────

  /** Cliente abre una conversación → entra al room */
  @SubscribeMessage("join:conversation")
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    const workspaceId = client.data.workspaceId as string | undefined;
    if (!workspaceId) {
      return { ok: false, error: "Unauthenticated" };
    }
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!conv) {
      return { ok: false, error: "Not found" };
    }
    await client.join(`conversation:${conversationId}`);
    return { ok: true, room: `conversation:${conversationId}` };
  }

  /** Cliente cierra una conversación → sale del room */
  @SubscribeMessage("leave:conversation")
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    await client.leave(`conversation:${conversationId}`);
    return { ok: true };
  }

  /** Ping de keepalive */
  @SubscribeMessage("ping")
  handlePing() {
    return { pong: true, ts: Date.now() };
  }

  // ── Métodos para emitir desde servicios ───────────────────────────────────

  /**
   * Emitir nuevo mensaje a todos los que están viendo la conversación
   * y actualizar el inbox del workspace.
   */
  emitNewMessage(conversationId: string, workspaceId: string, message: unknown) {
    // Todos en la conversación reciben el mensaje completo
    this.server.to(`conversation:${conversationId}`).emit("message:new", message);

    // Todo el workspace recibe un update del inbox (solo metadata)
    this.server.to(`workspace:${workspaceId}`).emit("conversation:updated", {
      id: conversationId,
      last_message_at: new Date().toISOString(),
    });
  }

  /**
   * Emitir actualización de media (descarga completada) a la conversación.
   * El frontend puede actualizar solo ese mensaje sin refetch completo.
   */
  emitMediaReady(payload: {
    message_id: string;
    conversation_id: string;
    media_type: string;
    media_status: string;
    media_download_url: string;
    media_mime_type: string | null;
    media_filename: string | null;
    media_caption: string | null;
  }) {
    this.server.to(`conversation:${payload.conversation_id}`).emit("message:media-ready", payload);
  }

  /**
   * Emitir cambio de estado de entrega de un mensaje.
   */
  emitMessageStatus(payload: {
    message_id: string;
    conversation_id: string;
    workspace_id: string;
    delivery_status: string;
    delivery_error?: string | null;
    external_message_id?: string | null;
    provider_message_id?: string | null;
    telegram_message_id?: string | null;
  }) {
    this.server.to(`conversation:${payload.conversation_id}`).emit("message:status", payload);
  }

  /**
   * Emitir cambio de estado/prioridad/asignación de una conversación.
   */
  emitConversationUpdated(workspaceId: string, conversation: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit("conversation:updated", conversation);
  }

  /**
   * Emitir notificación personal a un usuario específico.
   */
  emitNotification(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit("notification:new", notification);
  }

  /**
   * Emitir actualización de tarea al workspace.
   */
  emitTaskUpdated(workspaceId: string, task: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit("task:updated", task);
  }

  emitCaseUpdated(workspaceId: string, caseData: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit("case:updated", caseData);
  }

  emitAgentMoved(workspaceId: string, agentData: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit("agent:moved", agentData);
  }

  emitWorkspaceUpdated(workspaceId: string, workspace: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit("workspace:updated", workspace);
  }

  emitTokenBalanceUpdated(workspaceId: string, balance: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit("ai_token_balance_updated", balance);
  }

  emitAgentUpdated(conversationId: string, workspaceId: string, run: unknown) {
    this.server.to(`conversation:${conversationId}`).emit("agent:updated", {
      conversationId,
      workspaceId,
      run,
    });
  }

  /** Emit support orchestration lifecycle events to the workspace room. */
  emitOrchestrationProgress(
    workspaceId: string,
    payload: {
      event: "orchestration:started" | "orchestration:stage-complete" | "orchestration:done";
      run_id: string;
      diagnostic_case_id?: string | null;
      tier?: string;
      /** Present on stage-complete */
      stage?: {
        agent_slug: string;
        allowed: boolean;
        skipped_reason?: string;
        output_preview?: string;
        duration_ms?: number;
        error?: string;
        cost_credits?: number;
      };
      /** Present on done */
      result?: unknown;
    },
  ) {
    this.server.to(`workspace:${workspaceId}`).emit(payload.event, payload);
  }

  emitContactUpdated(workspaceId: string, contact: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit("contact:updated", contact);
  }

  // ── Call signaling (ephemeral, via Socket.IO only) ────────────────────────

  /** Notify callee of incoming call */
  emitCallRinging(userId: string, call: unknown) {
    this.server.to(`user:${userId}`).emit("call:ringing", call);
  }

  /** Notify caller that callee answered */
  emitCallAnswered(userId: string, call: unknown) {
    this.server.to(`user:${userId}`).emit("call:answered", call);
  }

  /** Notify caller that callee rejected */
  emitCallRejected(userId: string, call: unknown) {
    this.server.to(`user:${userId}`).emit("call:rejected", call);
  }

  /** Notify both parties that call ended */
  emitCallEnded(userId: string, call: unknown) {
    this.server.to(`user:${userId}`).emit("call:ended", call);
  }

  /** Forward SDP offer via Socket.IO (ephemeral, never persisted) */
  emitCallOffer(userId: string, payload: { call_id: string; sdp: string }) {
    this.server.to(`user:${userId}`).emit("call:offer", payload);
  }

  /** Forward SDP answer via Socket.IO (ephemeral, never persisted) */
  emitCallAnswer(userId: string, payload: { call_id: string; sdp: string }) {
    this.server.to(`user:${userId}`).emit("call:answer", payload);
  }

  /** Forward ICE candidate to the other party */
  emitCallIce(userId: string, payload: { call_id: string; candidate: string; sdp_mid: string; sdp_m_line_index: number }) {
    this.server.to(`user:${userId}`).emit("call:ice", payload);
  }
}
