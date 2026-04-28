import { Body, Controller, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('hacienda/webhook')
export class HaciendaWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async receiveCallback(
    @Query('token') token: string | undefined,
    @Body() payload: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    // Verify shared secret — set HACIENDA_WEBHOOK_SECRET and append ?token=<secret>
    // to the callback URL registered with Hacienda.
    const expectedSecret = this.configService.get<string>('HACIENDA_WEBHOOK_SECRET');
    if (expectedSecret) {
      if (!token || token !== expectedSecret) {
        throw new UnauthorizedException('Invalid webhook token');
      }
    }

    const clave = payload?.clave;
    if (!clave) {
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
