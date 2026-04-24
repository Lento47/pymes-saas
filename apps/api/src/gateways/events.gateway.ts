import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

// ─── Eventos emitidos al cliente ─────────────────────────────────────────────
// message:new          → nuevo mensaje en una conversación
// conversation:updated → cambio de estado/prioridad/asignación
// notification:new     → nueva notificación para el usuario
// task:updated         → tarea actualizada
// ─────────────────────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: {
    origin:
      process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ?? [
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ],
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly jwtService: JwtService) { }

  // ── Conexión ───────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) throw new Error('No token');

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
    this.logger.log(`Disconnected: ${client.id}`);
  }

  // ── Eventos del cliente ────────────────────────────────────────────────────

  /** Cliente abre una conversación → entra al room */
  @SubscribeMessage('join:conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    await client.join(`conversation:${conversationId}`);
    return { ok: true, room: `conversation:${conversationId}` };
  }

  /** Cliente cierra una conversación → sale del room */
  @SubscribeMessage('leave:conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    await client.leave(`conversation:${conversationId}`);
    return { ok: true };
  }

  /** Ping de keepalive */
  @SubscribeMessage('ping')
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
    this.server
      .to(`conversation:${conversationId}`)
      .emit('message:new', message);

    // Todo el workspace recibe un update del inbox (solo metadata)
    this.server
      .to(`workspace:${workspaceId}`)
      .emit('conversation:updated', {
        id: conversationId,
        last_message_at: new Date().toISOString(),
      });
  }

  /**
   * Emitir cambio de estado/prioridad/asignación de una conversación.
   */
  emitConversationUpdated(workspaceId: string, conversation: unknown) {
    this.server
      .to(`workspace:${workspaceId}`)
      .emit('conversation:updated', conversation);
  }

  /**
   * Emitir notificación personal a un usuario específico.
   */
  emitNotification(userId: string, notification: unknown) {
    this.server
      .to(`user:${userId}`)
      .emit('notification:new', notification);
  }

  /**
   * Emitir actualización de tarea al workspace.
   */
  emitTaskUpdated(workspaceId: string, task: unknown) {
    this.server
      .to(`workspace:${workspaceId}`)
      .emit('task:updated', task);
  }

  /**
   * Emitir actualización del workspace (rename, locale, plan, etc.) a todos los miembros.
   */
  emitWorkspaceUpdated(workspaceId: string, workspace: unknown) {
    this.server
      .to(`workspace:${workspaceId}`)
      .emit('workspace:updated', workspace);
  }
}
