import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CallStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { EventsGateway } from "../gateways/events.gateway";
import { NotificationsService } from "../notifications/notifications.service";
import { RingCallDto } from "./dto/ring-call.dto";

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async ring(workspaceId: string, callerId: string, dto: RingCallDto) {
    // ── Validate callee exists in workspace ──
    const calleeWorkspace = await this.prisma.workspaceUser.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: dto.to_user_id } },
      select: { user_id: true },
    });
    if (!calleeWorkspace) {
      throw new NotFoundException("User not found in this workspace");
    }

    // ── Check busy: callee already on or ringing a call ──
    const busyCall = await this.prisma.call.findFirst({
      where: {
        callee_id: dto.to_user_id,
        status: { in: [CallStatus.RINGING, CallStatus.ACTIVE] },
        ended_at: null,
      },
      select: { id: true },
    });
    if (busyCall) {
      throw new ForbiddenException("user_busy");
    }

    // ── Validate conversation exists if provided ──
    if (dto.conversation_id) {
      const conv = await this.prisma.conversation.findFirst({
        where: { id: dto.conversation_id, workspace_id: workspaceId },
        select: { id: true },
      });
      if (!conv) {
        throw new NotFoundException("Conversation not found");
      }
    }

    // ── Create call ──
    const call = await this.prisma.call.create({
      data: {
        workspace_id: workspaceId,
        caller_id: callerId,
        callee_id: dto.to_user_id,
        type: dto.type === "video" ? "VIDEO" : "AUDIO",
        status: "RINGING",
        conversation_id: dto.conversation_id ?? null,
      },
    });

    // ── Notify callee via Socket.IO ──
    this.events.emitCallRinging(dto.to_user_id, call);

    // ── Create in-app notification ──
    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { name: true },
    });

    this.notifications.create(workspaceId, {
      user_id: dto.to_user_id,
      type: "INCOMING_CALL",
      title: `Llamada entrante de ${caller?.name ?? "Desconocido"}`,
      body: `Llamada de ${dto.type === "video" ? "video" : "voz"}`,
      related_entity_type: "call",
      related_entity_id: call.id,
    });

    return call;
  }

  async answer(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException("Call not found");
    if (call.callee_id !== userId) throw new ForbiddenException("Not the callee");
    if (call.status !== CallStatus.RINGING) throw new ForbiddenException("Call is not ringing");

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { status: "ACTIVE", answered_at: new Date() },
    });

    this.events.emitCallAnswered(call.caller_id, updated);
    return updated;
  }

  async reject(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException("Call not found");
    if (call.callee_id !== userId) throw new ForbiddenException("Not the callee");
    if (call.status !== CallStatus.RINGING) throw new ForbiddenException("Call is not ringing");

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { status: "REJECTED", ended_at: new Date() },
    });

    this.events.emitCallRejected(call.caller_id, updated);
    return updated;
  }

  async end(callId: string, userId: string, qualityStats?: Record<string, unknown>) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException("Call not found");
    if (call.caller_id !== userId && call.callee_id !== userId) {
      throw new ForbiddenException("Not a participant");
    }
    if (call.status === CallStatus.ENDED || call.status === CallStatus.REJECTED || call.status === CallStatus.MISSED) {
      return call;
    }

    const now = new Date();
    const durationSeconds = call.answered_at
      ? Math.floor((now.getTime() - call.answered_at.getTime()) / 1000)
      : 0;

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: "ENDED",
        ended_at: now,
        duration_seconds: durationSeconds,
        quality_json: qualityStats ? (qualityStats as any) : undefined,
      },
    });

    // ── Notify both parties ──
    this.events.emitCallEnded(call.caller_id, updated);
    if (call.callee_id !== call.caller_id) {
      this.events.emitCallEnded(call.callee_id, updated);
    }

    // ── Insert call history message ──
    if (call.conversation_id) {
      await this.insertCallHistoryMessage(updated);
    }

    return updated;
  }

  async addIceCandidate(callId: string, userId: string, dto: { candidate: string; sdp_mid: string; sdp_m_line_index: number }) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException("Call not found");
    if (call.caller_id !== userId && call.callee_id !== userId) {
      throw new ForbiddenException("Not a participant");
    }

    const otherUserId = call.caller_id === userId ? call.callee_id : call.caller_id;
    this.events.emitCallIce(otherUserId, { call_id: callId, ...dto });
  }

  async getCall(callId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException("Call not found");
    return call;
  }

  /**
   * Called from the gateway on Socket.IO disconnect.
   * Auto-ends any active/ringing calls for the disconnected user.
   */
  async handleDisconnect(userId: string) {
    const activeCalls = await this.prisma.call.findMany({
      where: {
        OR: [{ caller_id: userId }, { callee_id: userId }],
        status: { in: [CallStatus.RINGING, CallStatus.ACTIVE] },
        ended_at: null,
      },
    });

    for (const call of activeCalls) {
      const now = new Date();

      if (call.status === CallStatus.RINGING) {
        // Mark as missed
        const updated = await this.prisma.call.update({
          where: { id: call.id },
          data: { status: "MISSED", ended_at: now },
        });
        this.events.emitCallEnded(call.caller_id === userId ? call.callee_id : call.caller_id, updated);

        if (call.conversation_id) {
          await this.insertCallHistoryMessage(updated);
        }
      } else if (call.status === CallStatus.ACTIVE) {
        // Mark as ended, compute duration
        const durationSeconds = call.answered_at
          ? Math.floor((now.getTime() - call.answered_at.getTime()) / 1000)
          : 0;

        const updated = await this.prisma.call.update({
          where: { id: call.id },
          data: { status: "ENDED", ended_at: now, duration_seconds: durationSeconds },
        });

        const otherUserId = call.caller_id === userId ? call.callee_id : call.caller_id;
        this.events.emitCallEnded(otherUserId, updated);

        if (call.conversation_id) {
          await this.insertCallHistoryMessage(updated);
        }
      }
    }
  }

  private async insertCallHistoryMessage(call: {
    id: string;
    conversation_id: string | null;
    caller_id: string;
    callee_id: string;
    type: string;
    status: string;
    duration_seconds: number;
    workspace_id: string;
  }) {
    if (!call.conversation_id) return;

    const [caller, callee] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: call.caller_id }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: call.callee_id }, select: { name: true } }),
    ]);

    const statusMap: Record<string, string> = {
      ENDED: "completed",
      MISSED: "missed",
      REJECTED: "rejected",
    };

    const bodyText = JSON.stringify({
      call_type: call.type === "VIDEO" ? "video" : "audio",
      status: statusMap[call.status] ?? call.status,
      duration_seconds: call.duration_seconds,
      caller_name: caller?.name ?? "Desconocido",
      callee_name: callee?.name ?? "Desconocido",
    });

    const message = await this.prisma.message.create({
      data: {
        workspace_id: call.workspace_id,
        conversation_id: call.conversation_id,
        direction: "INTERNAL",
        sender_name: "Sistema",
        sender_ref: "calls@pymeshub",
        body_text: bodyText,
        sent_at: new Date(),
        delivery_status: "SENT",
        message_type: "CALL",
        has_media: false,
        media_status: "NONE",
      },
    });

    this.events.emitNewMessage(call.conversation_id, call.workspace_id, {
      id: message.id,
      conversation_id: call.conversation_id,
      direction: "INTERNAL",
      sender_name: "Sistema",
      body_text: message.body_text,
      sent_at: message.sent_at?.toISOString(),
      created_at: message.created_at.toISOString(),
      message_type: "CALL",
      has_media: false,
      media_status: "none",
    });
  }
}
