import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InvoicesService } from '../../invoices/invoices.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { HaciendaStatus } from '@prisma/client';

@Injectable()
export class HaciendaProcessor {
  private readonly logger = new Logger(HaciendaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly notificationsService: NotificationsService,
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
        const updated = await this.invoicesService.bulkSyncPendingHaciendaStatuses(ws.workspace_id);

        if (updated > 0) {
          const fresh = await this.prisma.invoice.findMany({
            where: {
              workspace_id: ws.workspace_id,
              hacienda_status: { in: [HaciendaStatus.ACEPTADO, HaciendaStatus.RECHAZADO] },
              id: {
                in: (
                  await this.prisma.invoice.findMany({
                    where: {
                      workspace_id: ws.workspace_id,
                      hacienda_status: { in: [HaciendaStatus.ACEPTADO, HaciendaStatus.RECHAZADO] },
                      updated_at: { gte: new Date(Date.now() - 16 * 60 * 1000) },
                    },
                    select: { id: true },
                    take: 5,
                  })
                ).map(i => i.id),
              },
            },
            select: { id: true, number: true, hacienda_status: true },
            take: 5,
          });

          const admins = await this.prisma.workspaceMembership.findMany({
            where: {
              workspace_id: ws.workspace_id,
              role: { in: ['OWNER', 'ADMIN'] as any },
            },
            select: { user_id: true },
            take: 3,
          });

          const notified = new Set<string>();
          for (const inv of fresh) {
            for (const admin of admins) {
              if (notified.has(admin.user_id + inv.id)) continue;
              notified.add(admin.user_id + inv.id);

              const type = inv.hacienda_status === HaciendaStatus.ACEPTADO ? 'hacienda_aceptado' : 'hacienda_rechazado';
              const title = inv.hacienda_status === HaciendaStatus.ACEPTADO
                ? 'Factura aceptada por Hacienda'
                : 'Factura rechazada por Hacienda';
              const body = inv.hacienda_status === HaciendaStatus.ACEPTADO
                ? `La factura ${inv.number} fue aceptada por Hacienda.`
                : `La factura ${inv.number} fue rechazada por Hacienda. Revisá el error en Facturación.`;

              await this.notificationsService.create(ws.workspace_id, {
                user_id: admin.user_id,
                type,
                title,
                body,
                related_entity_type: 'invoice',
                related_entity_id: inv.id,
              }).catch(() => {});
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Hacienda poll failed for workspace ${ws.workspace_id}: ${(err as Error).message}`);
      }
    }
  }
}
