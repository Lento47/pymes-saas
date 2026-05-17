import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class ContactSalesService {
  private readonly logger = new Logger(ContactSalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async submitInquiry(data: Record<string, any>) {
    const inquiry = await this.prisma.contactSalesInquiry.create({
      data: {
        workspace_id: data.workspace_id ?? null,
        business_name: data.business_name,
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone,
        industry: data.industry,
        employee_count: data.employee_count,
        users_needed: data.users_needed,
        locations_count: data.locations_count,
        monthly_invoices_estimate: data.monthly_invoices_estimate,
        contacts_estimate: data.contacts_estimate,
        current_tools: data.current_tools,
        channels_needed: data.channels_needed ?? [],
        migration_needed: data.migration_needed ?? false,
        sso_needed: data.sso_needed ?? false,
        sla_needed: data.sla_needed ?? false,
        dedicated_onboarding_needed: data.dedicated_onboarding_needed ?? false,
        custom_workflows_needed: data.custom_workflows_needed ?? false,
        preferred_onboarding_date: data.preferred_onboarding_date ? new Date(data.preferred_onboarding_date) : null,
        message: data.message,
      },
    });

    this.logger.log(`New Business+ inquiry from ${data.business_name} (${data.email})`);

    this.sendNotifications(data, inquiry.id).catch((err) =>
      this.logger.error(`Failed to send inquiry notification: ${err?.message}`),
    );

    if (data.workspace_id) {
      try {
        await this.prisma.contact.create({
          data: {
            workspace_id: data.workspace_id,
            type: 'LEAD',
            full_name: data.contact_name,
            company_name: data.business_name,
            email: data.email,
            phone: data.phone,
          },
        });
      } catch {
        // Non-critical
      }
    }

    return inquiry;
  }

  private async sendNotifications(data: Record<string, any>, inquiryId: string) {
    const salesEmail = process.env.CONTACT_SALES_EMAIL || 'ventas@pymeshub.lat';
    const from = 'PymesHub <no-reply@pymeshub.lat>';

    const features = [];
    if (data.channels_needed?.length) features.push(`Canales: ${data.channels_needed.join(', ')}`);
    if (data.migration_needed) features.push('Migración de datos');
    if (data.sso_needed) features.push('SSO/SAML');
    if (data.sla_needed) features.push('SLA empresarial');
    if (data.dedicated_onboarding_needed) features.push('Onboarding dedicado');
    if (data.custom_workflows_needed) features.push('Workflows personalizados');

    const details = [
      `Empresa: ${data.business_name}`,
      `Contacto: ${data.contact_name}`,
      `Email: ${data.email}`,
      `Teléfono: ${data.phone || '—'}`,
      `Industria: ${data.industry || '—'}`,
      `Empleados: ${data.employee_count || '—'}`,
      `Usuarios: ${data.users_needed || '—'}`,
      `Sucursales: ${data.locations_count || '—'}`,
      `Facturas/mes: ${data.monthly_invoices_estimate || '—'}`,
      `Contactos: ${data.contacts_estimate || '—'}`,
      `Herramientas actuales: ${data.current_tools || '—'}`,
      features.length ? `Servicios: ${features.join(' | ')}` : null,
      data.preferred_onboarding_date ? `Fecha preferida: ${data.preferred_onboarding_date}` : null,
      data.message ? `Mensaje: ${data.message}` : null,
    ].filter(Boolean).join('\n');

    const bodyHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#5771ff">Nueva solicitud Business+</h2>
      <p style="color:#555">${data.business_name} quiere información sobre PymesHub Business+.</p>
      <pre style="background:#f5f5f5;padding:16px;border-radius:8px;font-size:14px;line-height:1.6">${details}</pre>
      <p style="color:#888;font-size:12px">ID: ${inquiryId} | ${new Date().toISOString()}</p>
    </div>`;

    try {
      await this.emailService.sendOutbound(
        { config_json: {}, type: 'EMAIL' } as any,
        salesEmail,
        `[PymesHub] Nueva solicitud Business+ — ${data.business_name}`,
        bodyHtml,
        details,
      );
    } catch (err) {
      this.logger.warn(`Sales notification email failed: ${err?.message}`);
    }

    if (data.email) {
      const confirmHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#5771ff">¡Gracias por tu interés, ${data.contact_name}!</h2>
        <p style="color:#333">Hemos recibido tu solicitud de información sobre PymesHub Business+. Nuestro equipo de ventas te contactará en las próximas 24 horas hábiles.</p>
        <p style="color:#333">Mientras tanto, puedes probar PymesHub gratis en <a href="https://app.pymeshub.lat/register" style="color:#5771ff">app.pymeshub.lat/register</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <p style="color:#888;font-size:12px">PymesHub — Otnel S.A., Limón, Costa Rica</p>
      </div>`;

      try {
        await this.emailService.sendOutbound(
          { config_json: {}, type: 'EMAIL' } as any,
          data.email,
          'Hemos recibido tu solicitud — PymesHub Business+',
          confirmHtml,
          `Gracias ${data.contact_name}. Recibimos tu solicitud. Te contactaremos pronto.`,
        );
      } catch (err) {
        this.logger.warn(`Confirmation email failed: ${err?.message}`);
      }
    }
  }

  async getInquiries(status?: string) {
    return this.prisma.contactSalesInquiry.findMany({
      where: status ? { status } : undefined,
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async updateInquiryStatus(id: string, status: string) {
    return this.prisma.contactSalesInquiry.update({
      where: { id },
      data: { status },
    });
  }
}
