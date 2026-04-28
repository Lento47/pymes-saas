import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ContactSalesService {
  private readonly logger = new Logger(ContactSalesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submitInquiry(data: any) {
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

    // Create a lead contact if workspace exists
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
        // Non-critical — lead creation can fail gracefully
      }
    }

    return inquiry;
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
