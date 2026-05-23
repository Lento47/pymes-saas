import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

const CREDITS_PER_CONTACT_DAY = 1;

export const CREDIT_PACKS = [
  { id: "pack_100",  credits: 100,  price_usd: 2.99,  label: "100 días de memoria" },
  { id: "pack_500",  credits: 500,  price_usd: 9.99,  label: "500 días de memoria" },
  { id: "pack_1500", credits: 1500, price_usd: 24.99, label: "1,500 días de memoria" },
  { id: "pack_5000", credits: 5000, price_usd: 69.99, label: "5,000 días de memoria" },
];

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBalance(workspaceId: string): Promise<number> {
    const balance = await this.prisma.workspaceCreditBalance.findUnique({
      where: { workspace_id: workspaceId },
      select: { balance: true },
    });
    return balance?.balance ?? 0;
  }

  async addCredits(
    workspaceId: string,
    amount: number,
    type: "PURCHASE" | "REFUND" | "BONUS",
    description?: string,
    paypalOrderId?: string,
  ): Promise<number> {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.workspaceCreditBalance.upsert({
        where: { workspace_id: workspaceId },
        create: { workspace_id: workspaceId, balance: amount },
        update: { balance: { increment: amount } },
      });

      await tx.creditTransaction.create({
        data: {
          workspace_id: workspaceId,
          amount,
          type,
          description,
          paypal_order_id: paypalOrderId,
        },
      });

      const updated = await tx.workspaceCreditBalance.findUnique({
        where: { workspace_id: workspaceId },
        select: { balance: true },
      });
      return updated!.balance;
    });

    this.logger.log(`Workspace ${workspaceId}: +${amount} credits (${type}). New balance: ${result}`);
    return result;
  }

  async deductCredits(
    workspaceId: string,
    amount: number,
    description: string,
  ): Promise<{ success: boolean; newBalance: number }> {
    const current = await this.getBalance(workspaceId);
    if (current < amount) {
      return { success: false, newBalance: current };
    }

    const newBalance = await this.prisma.$transaction(async (tx) => {
      await tx.workspaceCreditBalance.update({
        where: { workspace_id: workspaceId },
        data: { balance: { decrement: amount } },
      });

      await tx.creditTransaction.create({
        data: {
          workspace_id: workspaceId,
          amount: -amount,
          type: "CONSUMPTION",
          description,
        },
      });

      const updated = await tx.workspaceCreditBalance.findUnique({
        where: { workspace_id: workspaceId },
        select: { balance: true },
      });
      return updated!.balance;
    });

    return { success: true, newBalance };
  }

  async getTransactionHistory(workspaceId: string, limit = 20) {
    return this.prisma.creditTransaction.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "desc" },
      take: limit,
    });
  }

  async findTransactionByPaypalOrderId(orderId: string) {
    return this.prisma.creditTransaction.findFirst({
      where: { paypal_order_id: orderId },
    });
  }

  getCreditPacks() {
    return CREDIT_PACKS;
  }
}
