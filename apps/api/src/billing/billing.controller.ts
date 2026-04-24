import { Body, Controller, Get, Post, RawBodyRequest, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import Stripe from 'stripe';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckoutSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: { priceId: string; idempotencyKey: string },
  ) {
    if (!dto.priceId || !dto.idempotencyKey) {
      throw new BadRequestException('priceId and idempotencyKey are required');
    }

    const workspace = await this.getWorkspace(user.workspace_id);
    const customerId = await this.stripeService.createOrGetCustomer(
      user.workspace_id,
      user.email,
    );

    const successUrl = `${this.configService.get('APP_URL')}/settings/billing?success=true`;
    const cancelUrl = `${this.configService.get('APP_URL')}/settings/billing?canceled=true`;

    const session = await this.stripeService.createCheckoutSession(
      user.workspace_id,
      customerId,
      dto.priceId,
      dto.idempotencyKey,
      successUrl,
      cancelUrl,
    );

    return {
      sessionId: session.sessionId,
      url: session.url,
    };
  }

  @Post('webhook')
  async handleWebhook(@Req() request: RawBodyRequest<Request>) {
    const signature = request.headers['stripe-signature'] as string;
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      throw new BadRequestException('Missing signature or webhook secret');
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.verifyWebhookSignature(
        request.rawBody?.toString() || '',
        signature,
        webhookSecret,
      );
    } catch (error) {
      throw new BadRequestException(`Webhook signature verification failed: ${(error as Error).message}`);
    }

    await this.stripeService.handleWebhookEvent(event);

    return { received: true };
  }

  @Get('portal')
  @UseGuards(JwtAuthGuard)
  async getBillingPortal(@CurrentUser() user: AuthUser) {
    const url = await this.stripeService.getBillingPortalLink(user.workspace_id);
    return { url };
  }

  private async getWorkspace(workspace_id: string) {
    // This would be injected in real implementation
    return { id: workspace_id };
  }
}
