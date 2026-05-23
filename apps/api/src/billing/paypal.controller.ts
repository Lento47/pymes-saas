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

@Controller("billing/paypal")
export class PaypalController {
  private readonly logger = new Logger(PaypalController.name);

  constructor(
    private readonly paypal: PaypalService,
    private readonly credits: CreditsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("create-order")
  @UseGuards(JwtAuthGuard)
  async createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreatePaypalOrderDto) {
    try {
      let price: number;
      let creditAmount: number;

      if (dto.credits && dto.price) {
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

      const { captureId, status, amount } = await this.paypal.captureOrder(body.orderId);
      const creditAmount = this.amountToCredits(amount);

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
        },
      });

      this.logger.log(
        `Credits added: workspace=${user.workspace_id} credits=${creditAmount} order=${body.orderId} capture=${captureId}`,
      );

      return { success: true, credits: creditAmount, newBalance };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`PayPal captureOrder failed for workspace=${user.workspace_id}:`, error);
      throw new InternalServerErrorException("No se pudo completar la compra de créditos");
    }
  }

  private amountToCredits(amountUsd: number): number {
    if (amountUsd >= 69.99) return 5000;
    if (amountUsd >= 24.99) return 1500;
    if (amountUsd >= 9.99) return 500;
    if (amountUsd >= 2.99) return 100;
    return Math.round(amountUsd / 0.03);
  }
}
