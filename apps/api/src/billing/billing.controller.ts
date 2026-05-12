import { Body, Controller, Get, Logger, Param, Post, Query, RawBodyRequest, Req, Res, UseGuards, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaddleSdkService } from './paddle-sdk.service';
import { BillingInvoiceService } from './billing-invoice.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CreateCheckoutDto } from './dto/checkout.dto';
import { FilterBillingInvoicesDto } from './dto/filter-billing-invoices.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiRolesGuard } from '../api-tokens/api-roles.guard';
import { RequireApiRole } from '../api-tokens/api-roles.decorator';
import { ApiRole } from '../api-tokens/api-token.guard';

// ───────────────────────────────────────────────────────────────────────────
// IMPORTANTE — PADDLE ESTA EN SANDBOX.
//
// CUANDO SE PASE A PRODUCCION, ROTAR EN RAILWAY:
//   - PADDLE_API_KEY              → API KEY DE PROD
//   - PADDLE_ENVIRONMENT=production
//   - PADDLE_WEBHOOK_SECRET       → SECRETO DE PROD
//   - PADDLE_PRICE_*_MONTHLY/ANNUAL → PRICE IDs DE PROD
//   (LOS DE SANDBOX NO FUNCIONAN EN PROD Y VICEVERSA).
//
// LO QUE NO ES IMPORTANTE: EL CODIGO DE ESTE ARCHIVO NO CAMBIA AL PASAR A
// PROD — TODA LA CONFIGURACION VIVE EN ENV VARS.
// ───────────────────────────────────────────────────────────────────────────
@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly paddleService: PaddleSdkService,
    private readonly billingInvoice: BillingInvoiceService,
    private readonly configService: ConfigService,
  ) {}

  // PRIMERA COMPRA — CHECKOUT NUEVO. SI EL WORKSPACE YA TIENE SUBSCRIPCION,
  // USAR `/change-plan` EN VEZ (PRORRATEADO).
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCheckoutDto,
  ) {
    try {
      const customerId = await this.paddleService.createOrGetCustomer(
        user.workspace_id,
        user.email,
      );

      const appUrl = this.configService.get<string>('CORS_ORIGIN')?.split(',')[0] || 'https://pymeshub.lat';
      const result = await this.paddleService.createTransaction(
        user.workspace_id,
        customerId,
        dto.priceId,
        user.email,
      );

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Checkout failed for workspace=${user.workspace_id}:`, error);
      throw new InternalServerErrorException('No se pudo iniciar el checkout. Intentalo de nuevo o contacta a soporte.');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // CAMBIO DE PLAN — USAR PARA UPGRADE/DOWNGRADE DE UNA SUBSCRIPCION EXISTENTE.
  //
  // IMPORTANTE — REGLAS DE COBRO:
  //   - UPGRADE  → COBRA LA DIFERENCIA PRORRATEADA HOY MISMO.
  //   - DOWNGRADE → NO COBRA. ENTRA EN VIGOR EN EL PROXIMO CICLO. EL PLAN
  //                 ACTUAL (CARO) SIGUE ACTIVO HASTA QUE TERMINE EL PERIODO
  //                 YA PAGADO.
  //
  // SI EL WORKSPACE NO TIENE SUBSCRIPCION ACTIVA, ESTE ENDPOINT FALLARA Y
  // EL FRONTEND DEBE USAR `/checkout` (CHECKOUT NUEVO).
  // ────────────────────────────────────────────────────────────────────────
  @Post('change-plan')
  @UseGuards(JwtAuthGuard)
  async changePlan(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePlanDto,
  ) {
    try {
      return await this.paddleService.changePlan(user.workspace_id, dto.priceId);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Plan change failed for workspace=${user.workspace_id}:`, error);
      this.paddleService.createDiagnosticCase(
        user.workspace_id,
        `Error al cambiar de plan: ${(error as Error)?.message}`,
        'PLAN_CHANGE_FAILED',
        `Workspace ${user.workspace_id} intentó cambiar de plan y falló: ${(error as Error)?.message}`,
        'critical',
      ).catch(() => {});
      throw new InternalServerErrorException('No se pudo cambiar el plan. Intentalo de nuevo o contacta a soporte.');
    }
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  async cancelPlan(@CurrentUser() user: AuthUser) {
    try {
      return await this.paddleService.cancelSubscription(user.workspace_id);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Cancel plan failed for workspace=${user.workspace_id}:`, error);
      throw new InternalServerErrorException('No se pudo cancelar el plan. Intentalo de nuevo o contacta a soporte.');
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

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  async getInvoices(
    @CurrentUser() user: AuthUser,
    @Query() filters: FilterBillingInvoicesDto,
  ) {
    return this.billingInvoice.findByWorkspace(user.workspace_id, filters);
  }

  @Get('invoices/:id/pdf')
  @UseGuards(JwtAuthGuard)
  async getInvoicePdf(
    @CurrentUser() user: AuthUser,
    @Param('id', ValidateUUIDPipe) invoiceId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.billingInvoice.getPdfBuffer(invoiceId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, ApiRolesGuard)
  @RequireApiRole(ApiRole.FOUNDER, ApiRole.WORKSPACE, ApiRole.USER)
  async syncSubscription(
    @CurrentUser() user: AuthUser,
    @Body() dto?: { customerId?: string; subscriptionId?: string },
  ) {
    return this.paddleService.syncSubscription(user.workspace_id, dto?.customerId, dto?.subscriptionId);
  }

  @Get('addon-prices')
  @UseGuards(JwtAuthGuard)
  getAddonPrices() {
    return this.paddleService.getAvailableAddonPrices();
  }

  @Post('checkout-addon')
  @UseGuards(JwtAuthGuard)
  async createAddonCheckout(
    @CurrentUser() user: AuthUser,
    @Body('addonKey') addonKey: string,
  ) {
    if (!addonKey) throw new BadRequestException('addonKey is required');
    const customerId = await this.paddleService.createOrGetCustomer(user.workspace_id, user.email);
    return this.paddleService.createAddonTransaction(user.workspace_id, customerId, user.email, addonKey);
  }
}
