import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('hacienda/webhook')
export class HaciendaWebhookController {
  private readonly logger = new Logger(HaciendaWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  private verifySignature(rawBody: string, signature?: string): void {
    const secret = process.env.HACIENDA_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn('HACIENDA_WEBHOOK_SECRET not set — skipping signature check');
      return;
    }
    if (!signature) throw new UnauthorizedException('Missing X-Hacienda-Signature header.');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        throw new UnauthorizedException('Invalid webhook signature.');
      }
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid webhook signature.');
    }
  }

  @Post()
  async receiveCallback(
    @Body() payload: any,
    @Headers('x-hacienda-signature') signature?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.verifySignature(rawBody, signature);

    const clave = payload?.clave;
    if (!clave || typeof clave !== 'string' || clave.length > 60) {
      return { received: false, reason: 'missing-clave' };
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { clave },
      select: { id: true, notes_json: true },
    });

    if (!invoice) {
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
          hacienda_callback_meta: { userAgent: userAgent ?? null, receivedAt: new Date().toISOString() },
        } as any,
      },
    });

    return { received: true };
  }

  private mapStatus(value?: string) {
    switch ((value ?? '').toLowerCase()) {
      case 'recibido':
        return 'RECIBIDO';
      case 'procesando':
        return 'PROCESANDO';
      case 'aceptado':
        return 'ACEPTADO';
      case 'rechazado':
        return 'RECHAZADO';
      default:
        return 'ERROR';
    }
  }
}
