import {
  Body,
  Controller,
  Headers,
  Logger,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

@Controller('hacienda/webhook')
export class HaciendaWebhookController {
  private readonly logger = new Logger(HaciendaWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /hacienda/webhook/:workspaceId
   *
   * Workspace-scoped callback endpoint. The callbackUrl registered with Hacienda
   * must include the workspaceId: `https://api.pymeshub.lat/hacienda/webhook/{workspaceId}`.
   * This scoping ensures cross-tenant isolation when looking up invoices by clave.
   */
  @Post(':workspaceId')
  async receiveCallback(
    @Param('workspaceId') workspaceId: string,
    @Headers('x-PymesHub-webhook-token') headerToken: string | undefined,
    @Query('token') queryToken: string | undefined,
    @Body() payload: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    const expectedSecret = this.configService.get<string>('HACIENDA_WEBHOOK_SECRET');
    if (!expectedSecret) {
      this.logger.error('HACIENDA_WEBHOOK_SECRET no configurado — rechazando webhook');
      throw new UnauthorizedException('Webhook secret not configured');
    }
    const supplied = headerToken || queryToken;
    if (!supplied || !safeEqual(supplied, expectedSecret)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    const clave = payload?.clave;
    if (!clave) {
      return { received: false, reason: 'missing-clave' };
    }

    // Filter by workspace_id to prevent cross-tenant data access
    const invoice = await this.prisma.invoice.findFirst({
      where: { clave, workspace_id: workspaceId },
      select: { id: true, notes_json: true },
    });

    if (!invoice) {
      this.logger.warn(`Webhook: clave ${clave} no encontrada en workspace ${workspaceId}`);
      return { received: false, reason: 'invoice-not-found' };
    }

    const notePayload =
      invoice.notes_json && typeof invoice.notes_json === 'object'
        ? { ...(invoice.notes_json as Record<string, unknown>) }
        : {};

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        hacienda_status: this.mapStatus(payload?.['ind-estado']),
        hacienda_last_checked_at: new Date(),
        response_xml_storage_key: payload?.['respuesta-xml']
          ? `inline://response/${clave}`
          : undefined,
        notes_json: {
          ...notePayload,
          hacienda_callback: payload,
          hacienda_callback_meta: {
            userAgent: userAgent ?? null,
            receivedAt: new Date().toISOString(),
          },
        } as any,
      },
    });

    return { received: true };
  }

  private mapStatus(value?: string) {
    switch ((value ?? '').toLowerCase()) {
      case 'recibido':   return 'RECIBIDO';
      case 'procesando': return 'PROCESANDO';
      case 'aceptado':   return 'ACEPTADO';
      case 'rechazado':  return 'RECHAZADO';
      default:           return 'ERROR';
    }
  }
}
