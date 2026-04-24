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

const getWsCorsOrigins = () => {
  const origins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  if (origins?.length) return origins;
  if (process.env.NODE_ENV === 'production') return [];
  return ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://localhost:5173', 'http://127.0.0.1:5173'];
};

@WebSocketGateway({
  cors: {
    origin: getWsCorsOrigins(),
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

      // Guardar contexto en el socket (incluyendo el token para re-validación)
      client.data.userId = payload.sub;
      client.data.workspaceId = payload.workspace_id;
      client.data.role = payload.role;
      client.data.token = token;

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

  // ── Helpers ────────────────────────────────────────────────────────────────

  private revalidateToken(client: Socket): boolean {
    try {
      const token = client.data.token as string | undefined;
      if (!token) return false;
      this.jwtService.verify(token);
      return true;
    } catch {
      return false;
    }
  }

  // ── Eventos del cliente ────────────────────────────────────────────────────

  /** Cliente abre una conversación → entra al room */
  @SubscribeMessage('join:conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    if (!this.revalidateToken(client)) {
      client.emit('error', 'Session expired');
      client.disconnect();
      return;
    }
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
  handlePing(@ConnectedSocket() client: Socket) {
    if (!this.revalidateToken(client)) {
      client.emit('error', 'Session expired');
      client.disconnect();
      return;
    }
    return { pong: true, ts: Date.now() };
  }

  // ── Métodos para emitir desde servicios ───────────────────────────────────

  emitNewMessage(conversationId: string, workspaceId: string, message: unknown) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('message:new', message);

    this.server
      .to(`workspace:${workspaceId}`)
      .emit('conversation:updated', {
        id: conversationId,
        last_message_at: new Date().toISOString(),
      });
  }

  emitConversationUpdated(workspaceId: string, conversation: unknown) {
    this.server
      .to(`workspace:${workspaceId}`)
      .emit('conversation:updated', conversation);
  }

  emitNotification(userId: string, notification: unknown) {
    this.server
      .to(`user:${userId}`)
      .emit('notification:new', notification);
  }

  emitTaskUpdated(workspaceId: string, task: unknown) {
    this.server
      .to(`workspace:${workspaceId}`)
      .emit('task:updated', task);
  }

  emitWorkspaceUpdated(workspaceId: string, workspace: unknown) {
    this.server
      .to(`workspace:${workspaceId}`)
      .emit('workspace:updated', workspace);
  }
}
