import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(workspaceId: string, tool: string, args: Record<string, any>): Promise<any> {
    switch (tool) {
      case 'get_workspace':
        return this.getWorkspace(workspaceId);
      case 'get_stats':
        return this.getStats(workspaceId);
      case 'list_contacts':
        return this.listContacts(workspaceId, args);
      case 'list_tasks':
        return this.listTasks(workspaceId, args);
      case 'create_task':
        return this.createTask(workspaceId, args);
      case 'list_invoices':
        return this.listInvoices(workspaceId);
      case 'list_conversations':
        return this.listConversations(workspaceId, args);
      case 'list_automations':
        return this.listAutomations(workspaceId);
      case 'get_billing':
        return this.getBilling(workspaceId);
      case 'get_billing_invoices':
        return this.getBillingInvoices(workspaceId);
      case 'list_pipeline_deals':
        return this.listPipelineDeals(workspaceId);
      case 'get_settings':
        return this.getSettings(workspaceId);
      default:
        throw new Error(`Unknown tool: ${tool}. Available: get_workspace, get_stats, list_contacts, list_tasks, create_task, list_invoices, list_conversations, list_automations, get_billing, get_billing_invoices, list_pipeline_deals, get_settings`);
    }
  }

  private async getWorkspace(workspaceId: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true, plan: true, status: true, created_at: true },
    });
    return { workspace: ws };
  }

  private async getStats(workspaceId: string) {
    const [contacts, tasks, invoices, conversations] = await Promise.all([
      this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
      this.prisma.task.count({ where: { workspace_id: workspaceId } }),
      this.prisma.invoice.count({ where: { workspace_id: workspaceId } }),
      this.prisma.conversation.count({ where: { workspace_id: workspaceId } }),
    ]);
    return { stats: { contacts, tasks, invoices, conversations } };
  }

  private async listContacts(workspaceId: string, args: Record<string, any>) {
    const where: any = { workspace_id: workspaceId };
    if (args.search) where.full_name = { contains: args.search, mode: 'insensitive' };
    const contacts = await this.prisma.contact.findMany({
      where,
      select: { id: true, full_name: true, email: true, phone: true, type: true },
      take: 50,
    });
    return { contacts };
  }

  private async listTasks(workspaceId: string, args: Record<string, any>) {
    const where: any = { workspace_id: workspaceId };
    if (args.status) where.status = args.status;
    const tasks = await this.prisma.task.findMany({
      where,
      select: { id: true, title: true, status: true, priority: true, due_at: true },
      take: 50,
      orderBy: { created_at: 'desc' },
    });
    return { tasks };
  }

  private async createTask(workspaceId: string, args: Record<string, any>) {
    const task = await this.prisma.task.create({
      data: {
        workspace_id: workspaceId,
        title: args.title,
        description: args.description || '',
        priority: args.priority || 'MEDIUM',
        due_at: args.due_date ? new Date(args.due_date) : undefined,
        status: 'TODO',
      },
    });
    return { task };
  }

  private async listInvoices(workspaceId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true, number: true, amount: true, status: true, due_date: true },
      take: 50,
      orderBy: { created_at: 'desc' },
    });
    return { invoices };
  }

  private async listConversations(workspaceId: string, args: Record<string, any>) {
    const where: any = { workspace_id: workspaceId };
    if (args.status) where.status = args.status;
    const conversations = await this.prisma.conversation.findMany({
      where,
      select: { id: true, subject: true, status: true, priority: true, created_at: true },
      take: 50,
      orderBy: { created_at: 'desc' },
    });
    return { conversations };
  }

  private async listAutomations(workspaceId: string) {
    const automations = await this.prisma.automation.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true, name: true, enabled: true, trigger_type: true, action_type: true },
      take: 50,
    });
    return { automations };
  }

  private async getBilling(workspaceId: string) {
    const [sub, ws] = await Promise.all([
      this.prisma.workspaceSubscription.findFirst({
        where: { workspace_id: workspaceId },
        select: { plan: true, status: true, provider: true, current_period_start: true, current_period_end: true },
      }),
      this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } }),
    ]);
    return { subscription: sub, workspace_plan: ws?.plan };
  }

  private async getBillingInvoices(workspaceId: string) {
    const invoices = await this.prisma.billingInvoice.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true, number: true, plan_name: true, total: true, currency: true, status: true, issued_at: true },
      take: 50,
      orderBy: { issued_at: 'desc' },
    });
    return { billing_invoices: invoices };
  }

  private async listPipelineDeals(workspaceId: string) {
    const deals = await this.prisma.deal.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true, title: true, stage_id: true, value: true, status: true },
      take: 50,
      orderBy: { created_at: 'desc' },
    });
    return { deals };
  }

  private async getSettings(workspaceId: string) {
    const [ws, members] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, slug: true, plan: true, status: true, locale: true, timezone: true },
      }),
      this.prisma.workspaceUser.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
        take: 20,
      }),
    ]);
    return { workspace: ws, members };
  }
}
