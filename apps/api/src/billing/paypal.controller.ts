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

      const { captureId } = await this.paypal.captureOrder(body.orderId);

      // Order record must exist — it was created at create-order time and is
      // scoped to this workspace. If missing, refuse: never guess amounts from USD.
      const order = await this.prisma.paypalPaymentOrder.findFirst({
        where: { order_id: body.orderId, workspace_id: user.workspace_id },
      });
      if (!order) {
        throw new BadRequestException("Orden de pago no encontrada para este workspace.");
      }
      if (order.status === "COMPLETED") {
        throw new BadRequestException("Esta orden ya fue procesada.");
      }

      const purchaseType = order.purchase_type ?? "MEMORY_CREDITS";

      if (purchaseType === "AI_TOKENS") {
        const tokenAmount = order.tokens;
        if (!tokenAmount || tokenAmount <= 0) {
          throw new BadRequestException("La orden no tiene tokens registrados. Contactá a soporte.");
        }
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

      const creditAmount = order.credits;
      if (!creditAmount || creditAmount <= 0) {
        throw new BadRequestException("La orden no tiene créditos registrados. Contactá a soporte.");
      }
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

}
