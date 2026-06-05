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
import { AuditService } from "../audit/audit.service";
import { PaypalPaymentStatus } from "@prisma/client";
import { RequirePermission, Permission } from "../common/permissions";

// ── Server-authoritative pack lookup ─────────────────────────────────────────
// All packs must be defined server-side. The client ONLY sends packId.
// Price, tokens, and credits are never accepted from the client.

function resolvePackById(packId: string):
  | { purchase_type: "MEMORY_CREDITS"; price_usd: number; credits: number; tokens: null }
  | { purchase_type: "AI_TOKENS"; price_usd: number; credits: 0; tokens: number }
  | null
{
  const creditPack = CREDIT_PACKS.find((p) => p.id === packId);
  if (creditPack) {
    return { purchase_type: "MEMORY_CREDITS", price_usd: creditPack.price_usd, credits: creditPack.credits, tokens: null };
  }
  const tokenPack = AI_TOKEN_PACKS.find((p) => p.id === packId);
  if (tokenPack) {
    return { purchase_type: "AI_TOKENS", price_usd: tokenPack.price_usd, credits: 0, tokens: tokenPack.tokens };
  }
  return null;
}

@Controller("billing/paypal")
@RequirePermission(Permission.BILLING_MANAGE)
export class PaypalController {
  private readonly logger = new Logger(PaypalController.name);

  constructor(
    private readonly paypal: PaypalService,
    private readonly credits: CreditsService,
    private readonly aiTokens: AiTokenMeteringService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── POST /billing/paypal/create-order ──────────────────────────────────────
  // Client sends ONLY packId. Backend resolves price, credits, tokens.
  @Post("create-order")
  @UseGuards(JwtAuthGuard)
  async createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreatePaypalOrderDto) {
    const pack = resolvePackById(dto.packId);
    if (!pack) {
      throw new BadRequestException(`Pack "${dto.packId}" no encontrado`);
    }

    try {
      const { orderId } = await this.paypal.createOrder(pack.price_usd);

      await this.prisma.paypalPaymentOrder.create({
        data: {
          workspace_id: user.workspace_id,
          order_id: orderId,
          amount: pack.price_usd,
          credits: pack.credits,
          tokens: pack.tokens,
          purchase_type: pack.purchase_type,
          status: "CREATED",
        },
      });

      this.logger.log(
        `PayPal order created: workspace=${user.workspace_id} pack=${dto.packId} order=${orderId}`,
      );
      return { orderId };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`PayPal createOrder failed workspace=${user.workspace_id}:`, error);
      throw new InternalServerErrorException("No se pudo iniciar el pago con PayPal");
    }
  }

  // ── POST /billing/paypal/capture-order ────────────────────────────────────
  // Security-hardened order:
  //   1. Validate orderId presence
  //   2. Find DB record scoped to this workspace
  //   3. Reject if missing, already COMPLETED, or already PROCESSING (concurrent)
  //   4. Atomically mark PROCESSING (prevents double-capture on concurrent requests)
  //   5. Call PayPal capture API
  //   6. Credit tokens/credits to workspace
  //   7. Mark COMPLETED
  @Post("capture-order")
  @UseGuards(JwtAuthGuard)
  async captureOrder(@CurrentUser() user: AuthUser, @Body() body: { orderId: string }) {
    if (!body.orderId) {
      throw new BadRequestException("orderId es requerido");
    }

    // Step 2: Validate workspace ownership BEFORE touching PayPal
    const order = await this.prisma.paypalPaymentOrder.findFirst({
      where: { order_id: body.orderId, workspace_id: user.workspace_id },
    });

    if (!order) {
      throw new BadRequestException("Orden de pago no encontrada para este workspace.");
    }
    if (order.status === "COMPLETED") {
      throw new BadRequestException("Esta orden ya fue procesada.");
    }
    if (order.status === "PROCESSING") {
      throw new BadRequestException("Esta orden ya está siendo procesada. Intentá en unos segundos.");
    }

    // Step 4: Atomically claim the order — only succeeds if still CREATED
    const claimed = await this.prisma.paypalPaymentOrder.updateMany({
      where: {
        order_id: body.orderId,
        workspace_id: user.workspace_id,
        status: PaypalPaymentStatus.CREATED,
      },
      data: { status: PaypalPaymentStatus.PROCESSING },
    });

    if (claimed.count === 0) {
      // Another request won the race or status changed since our findFirst
      throw new BadRequestException("Esta orden ya fue procesada.");
    }

    try {
      // Step 5: Capture with PayPal (only after ownership + atomicity confirmed)
      const { captureId } = await this.paypal.captureOrder(body.orderId);

      const purchaseType = order.purchase_type ?? "MEMORY_CREDITS";

      if (purchaseType === "AI_TOKENS") {
        const tokenAmount = order.tokens;
        if (!tokenAmount || tokenAmount <= 0) {
          // Revert to FAILED so ops can investigate
          await this.prisma.paypalPaymentOrder.updateMany({
            where: { order_id: body.orderId },
            data: { status: PaypalPaymentStatus.FAILED, capture_id: captureId },
          });
          throw new BadRequestException("La orden no tiene tokens registrados. Contactá a soporte.");
        }

        // Step 6: Credit tokens
        const newBalance = await this.aiTokens.addTokens(
          user.workspace_id,
          tokenAmount,
          "PURCHASE",
          `Compra de ${tokenAmount} tokens IA vía PayPal`,
          body.orderId,
        );

        // Step 7: Mark COMPLETED
        await this.prisma.paypalPaymentOrder.updateMany({
          where: { order_id: body.orderId, workspace_id: user.workspace_id },
          data: { capture_id: captureId, status: PaypalPaymentStatus.COMPLETED },
        });

        // Auto-enable AI for open conversations
        const ws = await this.prisma.workspace.findUnique({
          where: { id: user.workspace_id },
          select: { settings_json: true },
        });
        const currentSettings =
          ws?.settings_json && typeof ws.settings_json === "object"
            ? (ws.settings_json as Record<string, unknown>)
            : {};
        if (!currentSettings.ai_agent_auto_active) {
          await this.prisma.workspace.update({
            where: { id: user.workspace_id },
            data: { settings_json: { ...currentSettings, ai_agent_auto_active: true } },
          });
        }
        await this.prisma.$executeRawUnsafe(
          `UPDATE conversations
           SET metadata_json = jsonb_set(COALESCE(metadata_json,'{}')::jsonb,'{ai_state}','"AI_ACTIVE"'),
               updated_at = NOW()
           WHERE workspace_id = $1
             AND status IN ('NEW','OPEN')
             AND (metadata_json->>'ai_state' IS NULL OR metadata_json->>'ai_state' != 'HUMAN_ACTIVE')`,
          user.workspace_id,
        );

        void this.audit.log(user.workspace_id, {
          user_id: user.id,
          action: "billing.tokens_purchased",
          entity_type: "paypal_order",
          entity_id: body.orderId,
          after: { tokens: tokenAmount, capture_id: captureId },
        });

        this.logger.log(
          `AI tokens added: workspace=${user.workspace_id} tokens=${tokenAmount} order=${body.orderId} capture=${captureId}`,
        );
        return { success: true, credits: 0, tokens: tokenAmount, newBalance: newBalance.available, tokenBalance: newBalance };
      }

      // MEMORY_CREDITS path
      const creditAmount = order.credits;
      if (!creditAmount || creditAmount <= 0) {
        await this.prisma.paypalPaymentOrder.updateMany({
          where: { order_id: body.orderId },
          data: { status: PaypalPaymentStatus.FAILED, capture_id: captureId },
        });
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
        data: { capture_id: captureId, status: PaypalPaymentStatus.COMPLETED },
      });

      void this.audit.log(user.workspace_id, {
        user_id: user.id,
        action: "billing.credits_purchased",
        entity_type: "paypal_order",
        entity_id: body.orderId,
        after: { credits: creditAmount, capture_id: captureId },
      });

      this.logger.log(
        `Credits added: workspace=${user.workspace_id} credits=${creditAmount} order=${body.orderId} capture=${captureId}`,
      );
      return { success: true, credits: creditAmount, tokens: 0, newBalance };

    } catch (error) {
      // Mark FAILED so the order is not left stuck in PROCESSING.
      // FAILED is terminal — user must create a new order via /create-order.
      if (!(error instanceof BadRequestException)) {
        await this.prisma.paypalPaymentOrder.updateMany({
          where: { order_id: body.orderId, status: PaypalPaymentStatus.PROCESSING },
          data: { status: PaypalPaymentStatus.FAILED },
        }).catch(() => {});
      }
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`PayPal captureOrder failed workspace=${user.workspace_id}:`, error);
      throw new InternalServerErrorException("No se pudo completar la compra");
    }
  }
}
