import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import type { AssistantMessage, ChatTokenUsage } from "../ai/cloudflare-ai.service";

export const AI_TOKEN_PACKS = [
  { id: "ai_tokens_100k", tokens: 100_000, price_usd: 2.99, label: "100k tokens IA" },
  { id: "ai_tokens_500k", tokens: 500_000, price_usd: 9.99, label: "500k tokens IA" },
  { id: "ai_tokens_1500k", tokens: 1_500_000, price_usd: 24.99, label: "1.5M tokens IA" },
  { id: "ai_tokens_5000k", tokens: 5_000_000, price_usd: 69.99, label: "5M tokens IA" },
];

export interface AiTokenBalanceSnapshot {
  balance: number;
  reserved: number;
  available: number;
}

export interface TokenReservationResult {
  success: boolean;
  reservationId: string | null;
  reservedTokens: number;
  balance: AiTokenBalanceSnapshot;
}

interface TokenContext {
  description?: string;
  conversationId?: string | null;
  messageId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AiTokenMeteringService {
  private readonly logger = new Logger(AiTokenMeteringService.name);

  constructor(private readonly prisma: PrismaService) {}

  estimateMessagesTokens(messages: AssistantMessage[], maxTokens = 1024): number {
    const promptTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    return Math.max(1, promptTokens + maxTokens);
  }

  async getBalance(workspaceId: string): Promise<AiTokenBalanceSnapshot> {
    const balance = await this.prisma.workspaceAiTokenBalance.findUnique({
      where: { workspace_id: workspaceId },
      select: { balance: true, reserved: true },
    });
    return this.toSnapshot(balance?.balance ?? 0, balance?.reserved ?? 0);
  }

  async addTokens(
    workspaceId: string,
    amount: number,
    type: "PURCHASE" | "REFUND" | "BONUS" | "ADJUSTMENT",
    description?: string,
    paypalOrderId?: string,
  ): Promise<AiTokenBalanceSnapshot> {
    if (amount <= 0) {
      this.logger.warn(`addTokens called with amount=${amount} for workspace=${workspaceId}`);
      return this.getBalance(workspaceId);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workspaceAiTokenBalance.upsert({
        where: { workspace_id: workspaceId },
        create: { workspace_id: workspaceId, balance: amount, reserved: 0 },
        update: { balance: { increment: amount } },
      });

      await tx.aiTokenTransaction.create({
        data: {
          workspace_id: workspaceId,
          amount,
          type,
          description,
          paypal_order_id: paypalOrderId,
        },
      });

      const updated = await tx.workspaceAiTokenBalance.findUniqueOrThrow({
        where: { workspace_id: workspaceId },
        select: { balance: true, reserved: true },
      });
      return this.toSnapshot(updated.balance, updated.reserved);
    });
  }

  async reserveTokens(
    workspaceId: string,
    amount: number,
    context: TokenContext = {},
  ): Promise<TokenReservationResult> {
    const safeAmount = Math.max(1, Math.ceil(amount));

    return this.prisma.$transaction(async (tx) => {
      await tx.workspaceAiTokenBalance.upsert({
        where: { workspace_id: workspaceId },
        create: { workspace_id: workspaceId, balance: 0, reserved: 0 },
        update: {},
      });

      const rows = await tx.$queryRawUnsafe<Array<{ balance: number; reserved: number }>>(
        `UPDATE "workspace_ai_token_balances"
         SET "reserved" = "reserved" + $1
         WHERE "workspace_id" = $2
           AND ("balance" - "reserved") >= $1
         RETURNING "balance", "reserved"`,
        safeAmount,
        workspaceId,
      );

      if (rows.length === 0) {
        const current = await tx.workspaceAiTokenBalance.findUniqueOrThrow({
          where: { workspace_id: workspaceId },
          select: { balance: true, reserved: true },
        });
        return {
          success: false,
          reservationId: null,
          reservedTokens: safeAmount,
          balance: this.toSnapshot(current.balance, current.reserved),
        };
      }

      const reservation = await tx.aiTokenReservation.create({
        data: {
          workspace_id: workspaceId,
          amount: safeAmount,
          description: context.description,
          conversation_id: context.conversationId,
          message_id: context.messageId,
          metadata_json: context.metadata as any,
        },
        select: { id: true },
      });

      const updated = rows[0];
      return {
        success: true,
        reservationId: reservation.id,
        reservedTokens: safeAmount,
        balance: this.toSnapshot(updated.balance, updated.reserved),
      };
    });
  }

  async consumeReservation(
    workspaceId: string,
    reservationId: string,
    usage: ChatTokenUsage,
    context: TokenContext = {},
  ): Promise<AiTokenBalanceSnapshot> {
    const actualTokens = Math.max(1, Math.ceil(usage.total_tokens));

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.aiTokenReservation.findFirst({
        where: { id: reservationId, workspace_id: workspaceId, status: "ACTIVE" },
        select: { id: true, amount: true },
      });
      if (!reservation) {
        const current = await tx.workspaceAiTokenBalance.findUnique({
          where: { workspace_id: workspaceId },
          select: { balance: true, reserved: true },
        });
        return this.toSnapshot(current?.balance ?? 0, current?.reserved ?? 0);
      }

      const balance = await tx.workspaceAiTokenBalance.findUniqueOrThrow({
        where: { workspace_id: workspaceId },
        select: { balance: true, reserved: true },
      });
      const chargedTokens = Math.min(actualTokens, balance.balance);

      await tx.workspaceAiTokenBalance.update({
        where: { workspace_id: workspaceId },
        data: {
          balance: { decrement: chargedTokens },
          reserved: { decrement: reservation.amount },
        },
      });

      await tx.aiTokenReservation.update({
        where: { id: reservation.id },
        data: {
          status: "CONSUMED",
          completed_at: new Date(),
          message_id: context.messageId,
          metadata_json: {
            ...(context.metadata ?? {}),
            charged_tokens: chargedTokens,
            actual_tokens: actualTokens,
          } as any,
        },
      });

      await tx.aiTokenTransaction.create({
        data: {
          workspace_id: workspaceId,
          amount: -chargedTokens,
          type: "CONSUMPTION",
          description: context.description,
          reservation_id: reservation.id,
          conversation_id: context.conversationId,
          message_id: context.messageId,
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: actualTokens,
          estimated: usage.estimated,
          provider: usage.provider,
          model: usage.model,
          metadata_json: context.metadata as any,
        },
      });

      const updated = await tx.workspaceAiTokenBalance.findUniqueOrThrow({
        where: { workspace_id: workspaceId },
        select: { balance: true, reserved: true },
      });
      return this.toSnapshot(updated.balance, updated.reserved);
    });
  }

  async releaseReservation(workspaceId: string, reservationId: string): Promise<AiTokenBalanceSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.aiTokenReservation.findFirst({
        where: { id: reservationId, workspace_id: workspaceId, status: "ACTIVE" },
        select: { id: true, amount: true },
      });
      if (!reservation) {
        const current = await tx.workspaceAiTokenBalance.findUnique({
          where: { workspace_id: workspaceId },
          select: { balance: true, reserved: true },
        });
        return this.toSnapshot(current?.balance ?? 0, current?.reserved ?? 0);
      }

      await tx.workspaceAiTokenBalance.update({
        where: { workspace_id: workspaceId },
        data: { reserved: { decrement: reservation.amount } },
      });
      await tx.aiTokenReservation.update({
        where: { id: reservation.id },
        data: { status: "RELEASED", completed_at: new Date() },
      });

      const updated = await tx.workspaceAiTokenBalance.findUniqueOrThrow({
        where: { workspace_id: workspaceId },
        select: { balance: true, reserved: true },
      });
      return this.toSnapshot(updated.balance, updated.reserved);
    });
  }

  async getTransactionHistory(workspaceId: string, limit = 30) {
    return this.prisma.aiTokenTransaction.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "desc" },
      take: limit,
    });
  }

  getTokenPacks() {
    return AI_TOKEN_PACKS;
  }

  private toSnapshot(balance: number, reserved: number): AiTokenBalanceSnapshot {
    return {
      balance,
      reserved,
      available: Math.max(0, balance - reserved),
    };
  }
}

export function estimateTokens(text: string | null | undefined): number {
  const value = typeof text === "string" ? text : "";
  if (!value.trim()) return 0;
  return Math.max(1, Math.ceil(value.length / 3));
}
