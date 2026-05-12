import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { HaciendaRecepcionService } from '../../hacienda/hacienda-recepcion.service';
import { HaciendaSigningService } from '../../hacienda/hacienda-signing.service';
import { HaciendaXmlBuilderService } from '../../hacienda/hacienda-xml-builder.service';
import { HaciendaXmlValidatorService } from '../../hacienda/hacienda-xml-validator.service';
import { FiscalSequenceService } from '../../hacienda/fiscal-sequence.service';
import { parseJsonValue } from '../../common/prisma/json';
import { HaciendaStatus } from '@prisma/client';
import { QUEUE_NAMES } from '../queues.constants';

interface HaciendaSubmitJobData {
  invoiceId: string;
  workspaceId: string;
}

@Injectable()
@Processor(QUEUE_NAMES.HACIENDA)
export class HaciendaProcessor extends WorkerHost {
  private readonly logger = new Logger(HaciendaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly haciendaRecepcion: HaciendaRecepcionService,
    private readonly haciendaSigning: HaciendaSigningService,
    private readonly haciendaXmlBuilder: HaciendaXmlBuilderService,
    private readonly haciendaXmlValidator: HaciendaXmlValidatorService,
    private readonly fiscalSequence: FiscalSequenceService,
  ) {
    super();
  }

  // ── BullMQ: async invoice submission ─────────────────────────────────────

  async process(job: Job<HaciendaSubmitJobData>): Promise<void> {
    const { invoiceId, workspaceId } = job.data;
    this.logger.log(`[hacienda-submit] job=${job.id} invoice=${invoiceId}`);

    try {
      await this.submitInvoice(workspaceId, invoiceId);
    } catch (err) {
      const message = (err as Error).message ?? 'error desconocido';
      this.logger.error(`[hacienda-submit] job=${job.id} invoice=${invoiceId} FAILED: ${message}`);

      // On final attempt, mark the invoice as ERROR
      if (job.attemptsMade >= (job.opts?.attempts ?? 3) - 1) {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            hacienda_status: HaciendaStatus.ERROR,
            hacienda_last_error: message.slice(0, 1000),
            hacienda_last_checked_at: new Date(),
            updated_at: new Date(),
          },
        }).catch(() => {});
      }

      throw err; // re-throw so BullMQ retries
    }
  }

  private async submitInvoice(workspaceId: string, invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, workspace_id: workspaceId },
      include: {
        lines: { orderBy: { line_number: 'asc' } },
        contact: true,
      },
    });

    if (!invoice) {
      throw new Error(`Factura ${invoiceId} no encontrada.`);
    }
    if (invoice.hacienda_status === HaciendaStatus.ACEPTADO) {
      this.logger.log(`[hacienda-submit] invoice=${invoiceId} already ACEPTADO — skipping`);
      return;
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true, workspace_tax_profile: true },
    });
    const workspaceTaxProfile = workspace?.workspace_tax_profile;
    const settings = parseJsonValue<Record<string, any>>(workspace?.settings_json, {});

    // Clave and consecutivo were already persisted by InvoicesService before enqueueing
    if (!invoice.clave || !invoice.consecutivo) {
      throw new Error(`Factura ${invoiceId} no tiene clave/consecutivo asignados.`);
    }

    const issueDate = invoice.issue_date ?? new Date();

    const lines = invoice.lines.length
      ? invoice.lines
      : [{
          line_number: 1,
          cabys_code: '',
          description: invoice.description ?? 'Servicio',
          quantity: 1,
          unit_of_measure: 'Unid',
          unit_price: Number(invoice.amount ?? 0),
          discount_amount: 0,
          subtotal: Number(invoice.amount ?? 0),
          tax_code: '01',
          tax_rate: 13,
          tax_amount: Number(invoice.amount ?? 0) * 0.13,
          total_line_amount: Number(invoice.amount ?? 0) * 1.13,
        }];

    const xml = this.haciendaXmlBuilder.buildInvoiceXml({
      invoice: {
        ...invoice,
        clave: invoice.clave,
        consecutivo: invoice.consecutivo,
        issue_date: issueDate,
      },
      workspaceTaxProfile,
      contact: invoice.contact,
      lines,
    });

    // Validate XML structure before signing and submitting
    this.haciendaXmlValidator.validate(xml);

    const signed = await this.haciendaSigning.signXml(workspaceId, xml);

    const signingEnabled = settings.hacienda_signing_enabled === true;
    if (signingEnabled && signed.signatureMode !== 'XADES_EPES') {
      throw new Error('No se pudo firmar el XML fiscal. Verifica el certificado y el PIN en Configuración.');
    }
    if (!signingEnabled && settings.hacienda_environment === 'production') {
      throw new Error('La firma digital debe estar habilitada para enviar a Hacienda en modo producción.');
    }

    const signedXmlKey = `hacienda/${workspaceId}/invoices/${invoiceId}/signed.xml`;
    await this.storage.upload(signedXmlKey, Buffer.from(signed.signedXml, 'utf8'), 'application/xml');

    const recepcionResponse = await this.haciendaRecepcion.submitComprobante(workspaceId, {
      clave: invoice.clave,
      fecha: this.formatRecepcionDate(issueDate),
      emisor: {
        tipoIdentificacion: workspaceTaxProfile?.identification_type ?? '',
        numeroIdentificacion: workspaceTaxProfile?.identification_number ?? '',
      },
      receptor: invoice.contact?.identification_type && invoice.contact?.identification_number
        ? {
            tipoIdentificacion: invoice.contact.identification_type,
            numeroIdentificacion: invoice.contact.identification_number,
          }
        : undefined,
      callbackUrl: settings.hacienda_callback_url,
      comprobanteXml: Buffer.from(signed.signedXml, 'utf8').toString('base64'),
    });

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        signed_xml_storage_key: signedXmlKey,
        hacienda_location_url: recepcionResponse.location,
        hacienda_submitted_at: new Date(),
        hacienda_last_checked_at: new Date(),
        hacienda_last_error: null,
        hacienda_status: HaciendaStatus.SUBMITTED,
        updated_at: new Date(),
      },
    });

    this.logger.log(`[hacienda-submit] invoice=${invoiceId} → SUBMITTED (location=${recepcionResponse.location})`);
  }

  private formatRecepcionDate(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, '') + '-06:00';
  }

  // ── Cron: poll pending Hacienda statuses every 15 min ────────────────────

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
