import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── System Templates ──────────────────────────────────────────────────

  async listSystemTemplates(type?: string, category?: string) {
    return this.prisma.systemTemplate.findMany({
      where: {
        is_active: true,
        ...(type ? { type } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async getSystemTemplate(id: string) {
    const t = await this.prisma.systemTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  // ─── Instantiate Templates ─────────────────────────────────────────────

  async instantiateAutomationTemplate(workspaceId: string, templateId: string, overrides?: Record<string, any>) {
    const template = await this.getSystemTemplate(templateId);
    if (template.type !== 'automation') throw new NotFoundException('Not an automation template');

    const body = template.body as any;
    return this.prisma.automationRule.create({
      data: {
        workspace_id: workspaceId,
        name: overrides?.name ?? template.name,
        description: template.description,
        trigger_type: body.trigger_type,
        trigger_config_json: body.trigger_config_json ?? {},
        condition_config_json: body.condition_config_json ?? null,
        action_config_json: body.action_config_json ?? {},
        enabled: true,
      },
    });
  }

  async instantiateMessageTemplate(workspaceId: string, templateId: string, overrides?: Record<string, any>) {
    const template = await this.getSystemTemplate(templateId);
    if (template.type !== 'message') throw new NotFoundException('Not a message template');

    const body = template.body as any;
    return this.prisma.messageTemplate.create({
      data: {
        workspace_id: workspaceId,
        channel: template.channel ?? 'WHATSAPP',
        name: overrides?.name ?? template.name,
        category: template.category,
        language: body.language ?? 'es',
        body: body.body ?? (body as any).text ?? '',
        status: 'DRAFT',
        variables: body.variables ?? undefined,
      },
    });
  }

  // ─── Workspace Templates ───────────────────────────────────────────────

  async listWorkspaceTemplates(industry?: string) {
    return this.prisma.workspaceTemplate.findMany({
      where: {
        is_active: true,
        ...(industry ? { industry } : {}),
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async applyWorkspaceTemplate(workspaceId: string, templateKey: string) {
    const template = await this.prisma.workspaceTemplate.findUnique({
      where: { key: templateKey },
    });
    if (!template) throw new NotFoundException('Workspace template not found');

    const results: Record<string, number> = { stages: 0, tags: 0, rules: 0 };

    // Apply pipeline stages
    const stages = template.pipeline_stages as any[];
    if (stages?.length) {
      await this.prisma.dealStage.createMany({
        data: stages.map(s => ({ workspace_id: workspaceId, name: s.name, order: s.order, color: s.color })),
      });
      results.stages = stages.length;
    }

    // Apply automation rules — use createMany for atomic batch insert
    const rules = template.automation_rules as any[];
    if (rules?.length) {
      await this.prisma.automationRule.createMany({
        data: rules.map(r => ({
          workspace_id: workspaceId,
          name: r.name,
          description: r.description,
          trigger_type: r.trigger_type,
          trigger_config_json: r.trigger_config_json ?? {},
          condition_config_json: r.condition_config_json ?? null,
          action_config_json: r.action_config_json ?? {},
          enabled: r.enabled ?? true,
        })),
      });
      results.rules = rules.length;
    }

    this.logger.log(`Applied workspace template "${templateKey}" to ${workspaceId}`);
    return results;
  }

  // ─── Seed data helpers ─────────────────────────────────────────────────

  async upsertSystemTemplate(data: Record<string, any>) {
    return this.prisma.systemTemplate.upsert({
      where: { key: data.key },
      update: {
        name: data.name,
        description: data.description,
        type: data.type,
        category: data.category,
        channel: data.channel,
        body: data.body,
        order: data.order ?? 0,
      },
      create: {
        key: data.key,
        name: data.name,
        description: data.description,
        type: data.type,
        category: data.category,
        channel: data.channel,
        body: data.body,
        order: data.order ?? 0,
      },
    });
  }

  async upsertWorkspaceTemplate(data: Record<string, any>) {
    return this.prisma.workspaceTemplate.upsert({
      where: { key: data.key },
      update: {
        name: data.name,
        description: data.description,
        industry: data.industry,
        pipeline_stages: data.pipeline_stages,
        contact_tags: data.contact_tags ?? [],
        automation_rules: data.automation_rules,
        invoice_config: data.invoice_config,
        order: data.order ?? 0,
      },
      create: {
        key: data.key,
        name: data.name,
        description: data.description,
        industry: data.industry,
        pipeline_stages: data.pipeline_stages,
        contact_tags: data.contact_tags ?? [],
        automation_rules: data.automation_rules,
        invoice_config: data.invoice_config,
        order: data.order ?? 0,
      },
    });
  }
}
