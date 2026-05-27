import {
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { PrismaService } from "../common/prisma/prisma.service";
import { PaypalService } from "./paypal.service";
import { CreditsService } from "../memory/credits.service";
import { CreatePaypalOrderDto } from "./dto/create-paypal-order.dto";
import { CREDIT_PACKS } from "../memory/credits.service";
import { AiTokenMeteringService, AI_TOKEN_PACKS } from "../ai-tokens/ai-token-metering.service";

@Controller("billing/paypal")
export class PaypalController {
  private readonly logger = new Logger(PaypalController.name);

  constructor(
    private readonly paypal: PaypalService,
    private readonly credits: CreditsService,
    private readonly aiTokens: AiTokenMeteringService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("create-order")
  @UseGuards(JwtAuthGuard)
  async createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreatePaypalOrderDto) {
    try {
      let price: number;
      let creditAmount: number;
      let tokenAmount: number | null = null;
      const purchaseType = dto.purchase_type ?? "MEMORY_CREDITS";

      if (purchaseType === "AI_TOKENS" && dto.tokens && dto.price) {
        price = dto.price;
        creditAmount = 0;
        tokenAmount = dto.tokens;
      } else if (purchaseType === "AI_TOKENS" && dto.packId) {
        const pack = AI_TOKEN_PACKS.find((p) => p.id === dto.packId);
        if (!pack) {
          throw new BadRequestException(`Pack "${dto.packId}" no encontrado`);
        }
        price = pack.price_usd;
        creditAmount = 0;
        tokenAmount = pack.tokens;
      } else if (dto.credits && dto.price) {
        price = dto.price;
        creditAmount = dto.credits;
      } else if (dto.packId) {
        const pack = CREDIT_PACKS.find((p) => p.id === dto.packId);
        if (!pack) {
          throw new BadRequestException(`Pack "${dto.packId}" no encontrado`);
        }
        price = pack.price_usd;
        creditAmount = pack.credits;
      } else {
        throw new BadRequestException("Debe enviar packId o credits+price");
      }

      const { orderId } = await this.paypal.createOrder(price);

      await this.prisma.paypalPaymentOrder.create({
        data: {
          workspace_id: user.workspace_id,
          order_id: orderId,
          amount: price,
          credits: creditAmount,
          tokens: tokenAmount,
          purchase_type: purchaseType,
          status: "CREATED",
        },
      });

      return { orderId };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`PayPal createOrder failed for workspace=${user.workspace_id}:`, error);
      throw new InternalServerErrorException("No se pudo iniciar el pago con PayPal");
    }
  }

  @Post("capture-order")
  @UseGuards(JwtAuthGuard)
  async captureOrder(@CurrentUser() user: AuthUser, @Body() body: { orderId: string }) {
    try {
      if (!body.orderId) {
        throw new BadRequestException("orderId es requerido");
      }

      const { captureId, amount } = await this.paypal.captureOrder(body.orderId);
      const order = await this.prisma.paypalPaymentOrder.findFirst({
        where: { order_id: body.orderId, workspace_id: user.workspace_id },
      });
      const purchaseType = order?.purchase_type ?? "MEMORY_CREDITS";

      if (purchaseType === "AI_TOKENS") {
        const tokenAmount = order?.tokens ?? this.amountToTokens(amount);
        const newBalance = await this.aiTokens.addTokens(
          user.workspace_id,
          tokenAmount,
          "PURCHASE",
          `Compra de ${tokenAmount} tokens IA vía PayPal`,
          body.orderId,
        );

        await this.prisma.paypalPaymentOrder.updateMany({
          where: { order_id: body.orderId, workspace_id: user.workspace_id },
          data: {
            capture_id: captureId,
            status: "COMPLETED",
            tokens: tokenAmount,
            purchase_type: "AI_TOKENS",
          },
        });

        const ws = await this.prisma.workspace.findUnique({
          where: { id: user.workspace_id },
          select: { settings_json: true },
        });
        const currentSettings =
          ws?.settings_json && typeof ws.settings_json === "object"
            ? (ws.settings_json as Record<string, any>)
            : {};
        if (!currentSettings.ai_agent_auto_active) {
          await this.prisma.workspace.update({
            where: { id: user.workspace_id },
            data: {
              settings_json: { ...currentSettings, ai_agent_auto_active: true },
            },
          });
        }

        await this.prisma.$executeRawUnsafe(
          `UPDATE conversations
           SET metadata_json = jsonb_set(
             COALESCE(metadata_json, '{}')::jsonb,
             '{ai_state}',
             '"AI_ACTIVE"'
           ),
           updated_at = NOW()
           WHERE workspace_id = $1
           AND status IN ('NEW', 'OPEN')
           AND (metadata_json->>'ai_state' IS NULL OR metadata_json->>'ai_state' != 'HUMAN_ACTIVE')`,
          user.workspace_id,
        );

        this.logger.log(
          `AI tokens added: workspace=${user.workspace_id} tokens=${tokenAmount} order=${body.orderId} capture=${captureId}`,
        );

        return {
          success: true,
          credits: 0,
          tokens: tokenAmount,
          newBalance: newBalance.available,
          tokenBalance: newBalance,
        };
      }

      const creditAmount = order?.credits ?? this.amountToCredits(amount);
      const newBalance = await this.credits.addCredits(
        user.workspace_id,
        creditAmount,
        "PURCHASE",
        `Compra de ${creditAmount} créditos vía PayPal`,
        body.orderId,
      );

      await this.prisma.paypalPaymentOrder.updateMany({
        where: { order_id: body.orderId, workspace_id: user.workspace_id },
        data: {
          capture_id: captureId,
          status: "COMPLETED",
          credits: creditAmount,
          purchase_type: "MEMORY_CREDITS",
        },
      });

      this.logger.log(
        `Credits added: workspace=${user.workspace_id} credits=${creditAmount} order=${body.orderId} capture=${captureId}`,
      );

      return { success: true, credits: creditAmount, tokens: 0, newBalance };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`PayPal captureOrder failed for workspace=${user.workspace_id}:`, error);
      throw new InternalServerErrorException("No se pudo completar la compra");
    }
  }

  private amountToCredits(amountUsd: number): number {
    if (amountUsd >= 69.99) return 5000;
    if (amountUsd >= 24.99) return 1500;
    if (amountUsd >= 9.99) return 500;
    if (amountUsd >= 2.99) return 100;
    return Math.round(amountUsd / 0.03);
  }

  private amountToTokens(amountUsd: number): number {
    if (amountUsd >= 49.99) return 5_000_000;
    if (amountUsd >= 19.99) return 1_500_000;
    if (amountUsd >= 9.99)  return 500_000;
    if (amountUsd >= 2.99)  return 100_000;
    return Math.round(amountUsd * 33_445);
  }
}
