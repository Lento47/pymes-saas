import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DemoDataService {
  private readonly logger = new Logger(DemoDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Creates comprehensive demo data for a workspace. Non-blocking (fire-and-forget). */
  async populateDemoWorkspace(workspaceId: string, workspaceName: string): Promise<void> {
    try {
      this.logger.log(`Populating demo data for workspace ${workspaceId}`);

      const channelWsp = await this.prisma.channel.create({
        data: {
          workspace_id: workspaceId,
          type: 'WHATSAPP',
          name: 'WhatsApp Demo',
          status: 'ACTIVE',
          config_json: { phone_number_id: 'demo-phone-id' },
        },
      });

      const channelEmail = await this.prisma.channel.create({
        data: {
          workspace_id: workspaceId,
          type: 'EMAIL',
          name: 'Correo Demo',
          status: 'ACTIVE',
          config_json: { address: `soporte@${workspaceName.toLowerCase().replace(/\s+/g, '-')}.com` },
        },
      });

      // ── Contacts (8) ────────────────────────────────────────────────────
      const contactsData = [
        { full_name: 'Acme Corp S.A.', company_name: 'Acme Corp', email: 'ventas@acmecorp.com', phone: '+50622221111', type: 'CUSTOMER' as const, tags: ['vip', 'demo'] },
        { full_name: 'Tecnología Digital CR', company_name: 'Tecnología Digital', email: 'info@tecdigital.cr', phone: '+50633332222', type: 'CUSTOMER' as const, tags: ['tech', 'demo'] },
        { full_name: 'Restaurante El Sabor', company_name: 'El Sabor S.A.', email: 'admin@elsabor.cr', phone: '+50644443333', type: 'CUSTOMER' as const, tags: ['food', 'demo'] },
        { full_name: 'Distribuidora Nacional', company_name: 'Distribuidora Nacional', email: 'compras@disnacional.cr', phone: '+50655554444', type: 'CUSTOMER' as const, tags: ['demo'] },
        { full_name: 'Consultores Asociados', company_name: 'Consultores Asociados', email: 'info@consultores.cr', phone: '+50666665555', type: 'LEAD' as const, tags: ['lead', 'demo'] },
        { full_name: 'Clínica San José', company_name: 'Clínica San José', email: 'admin@clinicasj.cr', phone: '+50677776666', type: 'LEAD' as const, tags: ['lead', 'health', 'demo'] },
        { full_name: 'Proveedora Industrial', company_name: 'Proveedora Industrial S.A.', email: 'ventas@provindustrial.cr', phone: '+50688887777', type: 'VENDOR' as const, tags: ['vendor', 'demo'] },
        { full_name: 'María Rodríguez', company_name: null, email: 'maria@email.com', phone: '+50699998888', type: 'CUSTOMER' as const, tags: ['demo'] },
      ];

      const contacts: Record<string, string> = {};
      for (const c of contactsData) {
        const contact = await this.prisma.contact.create({
          data: {
            workspace_id: workspaceId,
            type: c.type,
            full_name: c.full_name,
            company_name: c.company_name,
            email: c.email,
            phone: c.phone,
            tags_json: JSON.stringify(c.tags),
          },
        });
        contacts[c.full_name] = contact.id;
      }

      // ── Invoices (4) ─────────────────────────────────────────────────────
      const now = new Date();
      const future15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const inv1 = await this.prisma.invoice.create({
        data: {
          workspace_id: workspaceId,
          contact_id: contacts['Acme Corp S.A.'],
          number: 'DEMO-001',
          amount: 150000,
          currency: 'CRC',
          status: 'PAID',
          due_date: past30,
          paid_at: past30,
          issue_date: past30,
          document_type: 'FACTURA_ELECTRONICA',
          description: 'Servicios de consultoría mensual - Abril 2026',
        },
      });
      await this.prisma.invoiceLine.createMany({
        data: [
          { workspace_id: workspaceId, invoice_id: inv1.id, line_number: 1, description: 'Consultoría TI', quantity: 10, unit_price: 10000, subtotal: 100000, tax_amount: 13000, total_line_amount: 113000, tax_rate: 13, tax_code: '01' },
          { workspace_id: workspaceId, invoice_id: inv1.id, line_number: 2, description: 'Soporte técnico', quantity: 5, unit_price: 7400, subtotal: 37000, tax_amount: 4810, total_line_amount: 41810, tax_rate: 13, tax_code: '01' },
        ],
      });

      const inv2 = await this.prisma.invoice.create({
        data: {
          workspace_id: workspaceId,
          contact_id: contacts['Tecnología Digital CR'],
          number: 'DEMO-002',
          amount: 89500,
          currency: 'CRC',
          status: 'SENT',
          due_date: future15,
          issue_date: now,
          document_type: 'FACTURA_ELECTRONICA',
          description: 'Desarrollo de landing page',
        },
      });
      await this.prisma.invoiceLine.createMany({
        data: [
          { workspace_id: workspaceId, invoice_id: inv2.id, line_number: 1, description: 'Diseño web', quantity: 1, unit_price: 50000, subtotal: 50000, tax_amount: 6500, total_line_amount: 56500, tax_rate: 13, tax_code: '01' },
          { workspace_id: workspaceId, invoice_id: inv2.id, line_number: 2, description: 'Hosting anual', quantity: 1, unit_price: 29203, subtotal: 29203, tax_amount: 3797, total_line_amount: 33000, tax_rate: 13, tax_code: '01' },
        ],
      });

      const inv3 = await this.prisma.invoice.create({
        data: {
          workspace_id: workspaceId,
          contact_id: contacts['Restaurante El Sabor'],
          number: 'DEMO-003',
          amount: 245000,
          currency: 'CRC',
          status: 'OVERDUE',
          due_date: past7,
          issue_date: past30,
          document_type: 'FACTURA_ELECTRONICA',
          description: 'Desarrollo de sistema de pedidos',
        },
      });
      await this.prisma.invoiceLine.createMany({
        data: [
          { workspace_id: workspaceId, invoice_id: inv3.id, line_number: 1, description: 'Desarrollo backend', quantity: 20, unit_price: 8000, subtotal: 160000, tax_amount: 20800, total_line_amount: 180800, tax_rate: 13, tax_code: '01' },
          { workspace_id: workspaceId, invoice_id: inv3.id, line_number: 2, description: 'Capacitación', quantity: 5, unit_price: 11328, subtotal: 56640, tax_amount: 7363, total_line_amount: 64003, tax_rate: 13, tax_code: '01' },
        ],
      });

      const inv4 = await this.prisma.invoice.create({
        data: {
          workspace_id: workspaceId,
          contact_id: contacts['Consultores Asociados'],
          number: 'DEMO-004',
          amount: 12000,
          currency: 'CRC',
          status: 'DRAFT',
          due_date: future15,
          issue_date: now,
          document_type: 'FACTURA_ELECTRONICA',
          description: 'Revisión de documentos (borrador)',
        },
      });
      await this.prisma.invoiceLine.create({
        data: {
          workspace_id: workspaceId, invoice_id: inv4.id, line_number: 1, description: 'Revisión documental', quantity: 2, unit_price: 5310, subtotal: 10620, tax_amount: 1380, total_line_amount: 12000, tax_rate: 13, tax_code: '01',
        },
      });

      // ── Pipeline / Deals ──────────────────────────────────────────────────
      await this.prisma.dealStage.createMany({
        data: [
          { workspace_id: workspaceId, name: 'Prospección', order: 0, color: '#6366f1' },
          { workspace_id: workspaceId, name: 'Propuesta', order: 1, color: '#f59e0b' },
          { workspace_id: workspaceId, name: 'Negociación', order: 2, color: '#ef4444' },
          { workspace_id: workspaceId, name: 'Cerrado-ganado', order: 3, color: '#22c55e' },
          { workspace_id: workspaceId, name: 'Cerrado-perdido', order: 4, color: '#6b7280' },
        ],
      });

      const stages = await this.prisma.dealStage.findMany({ where: { workspace_id: workspaceId } });

      await this.prisma.deal.createMany({
        data: [
          {
            workspace_id: workspaceId,
            stage_id: stages.find(s => s.order === 1)!.id,
            contact_id: contacts['Consultores Asociados'],
            title: 'Implementación CRM PymeHub',
            value: 1200000,
            currency: 'CRC',
            priority: 'HIGH',
            status: 'OPEN',
            notes: 'Cliente interesado en migrar de Excel a PymeHub. Demo realizada el 15 de abril.',
          },
          {
            workspace_id: workspaceId,
            stage_id: stages.find(s => s.order === 3)!.id,
            contact_id: contacts['Acme Corp S.A.'],
            title: 'Servicio de mantenimiento mensual TI',
            value: 560000,
            currency: 'CRC',
            priority: 'MEDIUM',
            status: 'WON',
            notes: 'Contrato firmado por 12 meses.',
          },
        ],
      });

      // ── Conversations + Messages ──────────────────────────────────────────
      const conv1 = await this.prisma.conversation.create({
        data: {
          workspace_id: workspaceId,
          channel_id: channelWsp.id,
          contact_id: contacts['Tecnología Digital CR'],
          subject: 'Cotización de desarrollo web',
          status: 'OPEN',
          priority: 'URGENT',
        },
      });

      const now2 = Date.now();
      await this.prisma.message.createMany({
        data: [
          { workspace_id: workspaceId, conversation_id: conv1.id, direction: 'INBOUND', sender_name: 'Carlos (Tecnología Digital)', sender_ref: 'tg:+50633332222', body_text: 'Hola, necesito una cotización para desarrollar un e-commerce con carrito de compras. ¿Me pueden ayudar?', sent_at: new Date(now2 - 3600000 * 3) },
          { workspace_id: workspaceId, conversation_id: conv1.id, direction: 'OUTBOUND', sender_name: 'Equipo PymeHub', sender_ref: 'agent', body_text: '¡Claro que sí! ¿Cuántos productos aproximadamente y para qué fecha lo necesitarías?', sent_at: new Date(now2 - 3600000 * 2) },
          { workspace_id: workspaceId, conversation_id: conv1.id, direction: 'INBOUND', sender_name: 'Carlos (Tecnología Digital)', sender_ref: 'tg:+50633332222', body_text: 'Unos 200 productos. Lo necesito para junio.', sent_at: new Date(now2 - 3600000 * 1) },
          { workspace_id: workspaceId, conversation_id: conv1.id, direction: 'OUTBOUND', sender_name: 'Equipo PymeHub', sender_ref: 'agent', body_text: 'Perfecto. Te preparo la cotización hoy mismo y te la envío. ¿A qué correo?', sent_at: new Date(now2 - 1800000) },
          { workspace_id: workspaceId, conversation_id: conv1.id, direction: 'INBOUND', sender_name: 'Carlos (Tecnología Digital)', sender_ref: 'tg:+50633332222', body_text: 'info@tecdigital.cr ¡Gracias!', sent_at: new Date(now2 - 900000) },
        ],
      });

      await this.prisma.conversation.update({
        where: { id: conv1.id },
        data: { last_message_at: new Date(now2 - 900000) },
      });

      const conv2 = await this.prisma.conversation.create({
        data: {
          workspace_id: workspaceId,
          channel_id: channelEmail.id,
          contact_id: contacts['Restaurante El Sabor'],
          subject: 'Problema con factura DEMO-003',
          status: 'OPEN',
          priority: 'HIGH',
        },
      });

      await this.prisma.message.createMany({
        data: [
          { workspace_id: workspaceId, conversation_id: conv2.id, direction: 'INBOUND', sender_name: 'Administración El Sabor', sender_ref: 'admin@elsabor.cr', body_text: 'Hola, la factura DEMO-003 tiene un error en el monto del IVA. ¿Pueden revisarla?', sent_at: new Date(now2 - 7200000) },
          { workspace_id: workspaceId, conversation_id: conv2.id, direction: 'OUTBOUND', sender_name: 'Equipo PymeHub', sender_ref: 'agent', body_text: 'Revisamos de inmediato y te confirmamos.', sent_at: new Date(now2 - 3600000) },
          { workspace_id: workspaceId, conversation_id: conv2.id, direction: 'INBOUND', sender_name: 'Administración El Sabor', sender_ref: 'admin@elsabor.cr', body_text: 'Gracias, quedo atenta.', sent_at: new Date(now2 - 1800000) },
        ],
      });

      await this.prisma.conversation.update({
        where: { id: conv2.id },
        data: { last_message_at: new Date(now2 - 1800000) },
      });

      // ── Automations (3) ──────────────────────────────────────────────────
      await this.prisma.automationRule.createMany({
        data: [
          {
            workspace_id: workspaceId,
            name: 'Asignar WhatsApp urgente',
            description: 'Asigna automáticamente conversaciones urgentes de WhatsApp al dueño del workspace',
            trigger_type: 'MESSAGE_RECEIVED',
            trigger_config_json: { channel: 'WHATSAPP', priority: 'URGENT' },
            condition_config_json: { field: 'priority', operator: 'eq', value: 'URGENT' },
            action_config_json: { type: 'set_priority', priority: 'URGENT' },
            enabled: true,
          },
          {
            workspace_id: workspaceId,
            name: 'Etiquetar conversación de facturación',
            description: 'Detecta mensajes sobre facturas y los categoriza como billing',
            trigger_type: 'MESSAGE_RECEIVED',
            trigger_config_json: { keywords: ['factura', 'pago', 'cobro', 'deuda'] },
            condition_config_json: { field: 'body_text', operator: 'contains', value: 'factura' },
            action_config_json: { type: 'set_status', status: 'PENDING' },
            enabled: true,
          },
          {
            workspace_id: workspaceId,
            name: 'Notificar nueva conversación',
            description: 'Envía notificación cuando se crea una nueva conversación',
            trigger_type: 'CONVERSATION_CREATED',
            trigger_config_json: {},
            condition_config_json: null,
            action_config_json: { type: 'notify_in_app', title: 'Nueva conversación', body: 'Se ha creado una nueva conversación en tu inbox' },
            enabled: true,
          },
        ],
      });

      // ── Tasks (4) ─────────────────────────────────────────────────────────
      await this.prisma.task.createMany({
        data: [
          { workspace_id: workspaceId, title: 'Revisar cotización de Tecnología Digital', description: 'Preparar cotización para e-commerce con 200 productos. Fecha límite: hoy.', status: 'IN_PROGRESS', priority: 'HIGH', due_at: new Date(now.getTime() + 86400000), source: 'MANUAL' },
          { workspace_id: workspaceId, title: 'Llamar a Clínica San José', description: 'Seguimiento de lead. Contactar a administración.', status: 'TODO', priority: 'MEDIUM', due_at: new Date(now.getTime() + 2 * 86400000), source: 'MANUAL' },
          { workspace_id: workspaceId, title: 'Actualizar datos de Acme Corp', description: 'Verificar dirección y teléfono actualizados para facturación electrónica.', status: 'TODO', priority: 'LOW', source: 'MANUAL' },
          { workspace_id: workspaceId, title: 'Corregir factura DEMO-003', description: 'Revisar error de IVA reportado por Restaurante El Sabor. Corregir y reenviar.', status: 'TODO', priority: 'HIGH', due_at: new Date(now.getTime() + 86400000), source: 'MANUAL', conversation_id: conv2.id },
        ],
      });

      // ── Document ──────────────────────────────────────────────────────────
      await this.prisma.document.create({
        data: {
          workspace_id: workspaceId,
          file_name: 'muestra-contrato-servicio.pdf',
          mime_type: 'application/pdf',
          storage_key: `demo/${workspaceId}/muestra-contrato.pdf`,
          file_size: 102400,
          status: 'UPLOADED',
          contact_id: contacts['Acme Corp S.A.'],
        },
      });

      // ── Set quick-start checklist ─────────────────────────────────────────
      await this.updateQuickStartProgress(workspaceId, {
        workspace_created: true,
        contacts_added: true,
        invoicing_configured: true,
        whatsapp_connected: false,
        email_connected: true,
        hacienda_configured: false,
        team_invited: false,
      });

      this.logger.log(`Demo data populated for workspace ${workspaceId}: 8 contacts, 4 invoices, 2 deals, 2 conversations, 3 automations, 4 tasks`);

    } catch (err) {
      this.logger.error(`Failed to populate demo data for workspace ${workspaceId}: ${(err as Error).message}`);
    }
  }

  /** Update quick-start checklist progress in workspace settings_json */
  private async updateQuickStartProgress(workspaceId: string, progress: Record<string, boolean>) {
    try {
      const ws = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings_json: true },
      });
      const current = (ws?.settings_json as any) ?? {};
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          settings_json: { ...current, quick_start_progress: progress },
        },
      });
    } catch {
      // Non-critical
    }
  }
}
