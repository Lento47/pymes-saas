import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { HaciendaRecepcionService } from '../../hacienda/hacienda-recepcion.service';
import { HaciendaStatus } from '@prisma/client';

@Injectable()
export class HaciendaProcessor {
  private readonly logger = new Logger(HaciendaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly haciendaRecepcion: HaciendaRecepcionService,
  ) {}

  @Cron('*/15 * * * *')
  async pollPendingHaciendaStatuses(): Promise<void> {
    this.logger.log('Running Hacienda status polling cron');

    const workspaces = await this.prisma.invoice.findMany({
      where: {
        hacienda_status: { in: [HaciendaStatus.SUBMITTED, HaciendaStatus.RECIBIDO, HaciendaStatus.PROCESANDO] },
        clave: { not: null },
        hacienda_last_checked_at: { lt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { workspace_id: true },
      distinct: ['workspace_id'],
      take: 20,
    });

    this.logger.log(`Found ${workspaces.length} workspaces with pending Hacienda invoices`);

    for (const ws of workspaces) {
      try {
        const pending = await this.prisma.invoice.findMany({
          where: {
            workspace_id: ws.workspace_id,
            hacienda_status: { in: [HaciendaStatus.SUBMITTED, HaciendaStatus.RECIBIDO, HaciendaStatus.PROCESANDO] },
            clave: { not: null },
          },
          select: { id: true, clave: true },
          take: 5,
          orderBy: { hacienda_last_checked_at: 'asc' as const },
        });

        for (const inv of pending) {
          try {
            const response = await this.haciendaRecepcion.getRecepcionStatus(ws.workspace_id, inv.clave!);
            const newStatus = this.mapHaciendaStatus(response?.['ind-estado']);

            await this.prisma.invoice.update({
              where: { id: inv.id },
              data: {
                hacienda_status: newStatus,
                hacienda_last_checked_at: new Date(),
                hacienda_last_error: newStatus === HaciendaStatus.RECHAZADO ? 'Hacienda rechazó el comprobante.' : null,
                updated_at: new Date(),
              },
            });

            if (newStatus === HaciendaStatus.ACEPTADO || newStatus === HaciendaStatus.RECHAZADO) {
              const invoice = await this.prisma.invoice.findUnique({
                where: { id: inv.id },
                select: { id: true, number: true, hacienda_status: true },
              });

              if (invoice) {
                const admins = await this.prisma.workspaceUser.findMany({
                  where: {
                    workspace_id: ws.workspace_id,
                    role: { in: ['OWNER', 'ADMIN'] as any },
                  },
                  select: { user_id: true },
                  take: 3,
                });

                const type = newStatus === HaciendaStatus.ACEPTADO ? 'hacienda_aceptado' : 'hacienda_rechazado';
                const title = newStatus === HaciendaStatus.ACEPTADO
                  ? 'Factura aceptada por Hacienda'
                  : 'Factura rechazada por Hacienda';
                const body = newStatus === HaciendaStatus.ACEPTADO
                  ? `La factura ${invoice.number} fue aceptada por Hacienda.`
                  : `La factura ${invoice.number} fue rechazada por Hacienda. Revisá el error en Facturación.`;

                for (const admin of admins) {
                  await this.notificationsService.create(ws.workspace_id, {
                    user_id: admin.user_id,
                    type,
                    title,
                    body,
                    related_entity_type: 'invoice',
                    related_entity_id: invoice.id,
                  }).catch(() => {});
                }
              }
            }
          } catch (err) {
            this.logger.warn(`Auto-sync failed for invoice ${inv.id}: ${(err as Error).message}`);
          }
        }
      } catch (err) {
        this.logger.warn(`Hacienda poll failed for workspace ${ws.workspace_id}: ${(err as Error).message}`);
      }
    }
  }

  private mapHaciendaStatus(indEstado: string | undefined): HaciendaStatus {
    switch (indEstado) {
      case 'recibido': return HaciendaStatus.RECIBIDO;
      case 'procesando': return HaciendaStatus.PROCESANDO;
      case 'aceptado': return HaciendaStatus.ACEPTADO;
      case 'rechazado': return HaciendaStatus.RECHAZADO;
      case 'error': return HaciendaStatus.ERROR;
      default: return HaciendaStatus.SUBMITTED;
    }
  }
}
