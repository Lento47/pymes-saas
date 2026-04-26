import { Body, Controller, Get, Post, RawBodyRequest, Req, UseGuards, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaddleService } from './paddle.service';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly paddleService: PaddleService,
    private readonly configService: ConfigService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @CurrentUser() user: AuthUser,
    @Body() dto: { priceId: string },
  ) {
    if (!dto.priceId) {
      throw new BadRequestException('priceId is required');
    }

    try {
      const customerId = await this.paddleService.createOrGetCustomer(
        user.workspace_id,
        user.email,
      );

      const result = await this.paddleService.createTransaction(
        user.workspace_id,
        customerId,
        dto.priceId,
      );

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        `Checkout failed: ${(error as Error).message}`,
      );
    }
  }

  @Post('webhook')
  async handleWebhook(@Req() request: RawBodyRequest<Request>) {
    const signature = request.headers['paddle-signature'] as string;
    const webhookSecret = this.configService.get<string>('PADDLE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      throw new BadRequestException('Missing paddle-signature header or webhook secret');
    }

    let event: any;
    try {
      event = await this.paddleService.verifyWebhookSignature(
        request.rawBody?.toString() || JSON.stringify(request.body),
        webhookSecret,
        signature,
      );
    } catch (error) {
      throw new BadRequestException(`Webhook signature verification failed: ${(error as Error).message}`);
    }

    await this.paddleService.handleWebhookEvent(event);

    return { received: true };
  }

  @Get('prices')
  @UseGuards(JwtAuthGuard)
  getAvailablePrices() {
    return this.paddleService.getAvailablePrices();
  }

  @Get('portal')
  @UseGuards(JwtAuthGuard)
  async getBillingPortal(@CurrentUser() user: AuthUser) {
    try {
      const url = await this.paddleService.getPortalLink(user.workspace_id);
      return { url };
    } catch {
      return { url: null };
    }
  }
}
