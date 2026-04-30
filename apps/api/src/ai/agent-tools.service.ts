import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { InsightsService } from '../insights/insights.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    private readonly searchService: SearchService,
  ) {}

  async execute(workspaceId: string, tool: string, args: Record<string, any>): Promise<any> {
    switch (tool) {
      case 'get_workspace':
        return this.getWorkspace(workspaceId);
      case 'get_stats':
        return this.getStats(workspaceId);
      case 'get_insights':
        return this.getInsights(workspaceId);
      case 'search':
        return this.search(workspaceId, args);
      case 'list_contacts':
        return this.listContacts(workspaceId, args);
      case 'list_tasks':
        return this.listTasks(workspaceId, args);
      case 'create_task':
        return this.createTask(workspaceId, args);
      case 'update_task':
        return this.updateTask(workspaceId, args);
      case 'list_invoices':
        return this.listInvoices(workspaceId);
      case 'list_conversations':
        return this.listConversations(workspaceId, args);
      case 'get_conversation_detail':
        return this.getConversationDetail(workspaceId, args);
      case 'reply_conversation':
        return this.replyConversation(workspaceId, args);
      case 'list_automations':
        return this.listAutomations(workspaceId);
      case 'create_automation':
        return this.createAutomation(workspaceId, args);
      case 'toggle_automation':
        return this.toggleAutomation(workspaceId, args);
      case 'get_billing':
        return this.getBilling(workspaceId);
      case 'get_billing_invoices':
        return this.getBillingInvoices(workspaceId);
      case 'list_pipeline_deals':
        return this.listPipelineDeals(workspaceId);
      case 'create_deal':
        return this.createDeal(workspaceId, args);
      case 'move_deal':
        return this.moveDeal(workspaceId, args);
      case 'list_documents':
        return this.listDocuments(workspaceId, args);
      case 'get_settings':
        return this.getSettings(workspaceId);
      default:
        throw new BadRequestException(`Unknown tool: ${tool}`);
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

  private async getInsights(workspaceId: string) {
    const results = await this.insights.getInsights(workspaceId);
    return { insights: results };
  }

  private async search(workspaceId: string, args: Record<string, any>) {
    const q = args.q || args.query || '';
    if (!q) throw new BadRequestException('search requires a "q" argument');
    const typesArr = args.types ? (args.types as string).split(',').map((t: string) => t.trim()) : [];
    const results = await this.searchService.search(workspaceId, q, typesArr, 10);
    return { results };
  }

  private async getConversationDetail(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    if (!id) throw new BadRequestException('get_conversation_detail requires "id" argument');
    const [conv, messages] = await Promise.all([
      this.prisma.conversation.findFirst({
        where: { id, workspace_id: workspaceId },
        select: { id: true, subject: true, status: true, priority: true, category: true, created_at: true, contact: { select: { full_name: true, email: true } } },
      }),
      this.prisma.message.findMany({
        where: { conversation_id: id, workspace_id: workspaceId },
        select: { id: true, direction: true, body_text: true, sender_name: true, sent_at: true },
        take: 100,
        orderBy: { sent_at: 'asc' },
      }),
    ]);
    if (!conv) throw new BadRequestException(`Conversation "${id}" not found`);
    return { conversation: conv, messages };
  }

  private async replyConversation(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    const text = args.text || args.message;
    if (!id || !text) throw new BadRequestException('reply_conversation requires "id" and "text"');
    const msg = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: id,
        direction: 'OUTBOUND',
        body_text: text,
        sender_name: 'HubbyAgent',
      },
    });
    return { message: msg };
  }

  private async createAutomation(workspaceId: string, args: Record<string, any>) {
    if (!args.name || !args.trigger_type) {
      throw new BadRequestException('create_automation requires "name" and "trigger_type"');
    }
    const auto = await this.prisma.automation.create({
      data: {
        workspace_id: workspaceId,
        name: args.name,
        description: args.description || '',
        trigger_type: args.trigger_type,
        trigger_config_json: args.trigger_config || {},
        action_config_json: args.action_config || args.config || {},
        condition_config_json: args.condition_config || undefined,
        enabled: args.enabled !== false,
      },
    });
    return { automation: auto };
  }

  private async toggleAutomation(workspaceId: string, args: Record<string, any>) {
    if (!args.id) throw new BadRequestException('toggle_automation requires "id"');
    const existing = await this.prisma.automation.findFirst({
      where: { id: args.id, workspace_id: workspaceId },
    });
    if (!existing) throw new BadRequestException(`Automation "${args.id}" not found`);
    const updated = await this.prisma.automation.update({
      where: { id: args.id },
      data: { enabled: args.enabled !== undefined ? args.enabled : !existing.enabled },
    });
    return { automation: updated };
  }

  private async updateTask(workspaceId: string, args: Record<string, any>) {
    if (!args.id) throw new BadRequestException('update_task requires "id"');
    const data: any = {};
    if (args.title !== undefined) data.title = args.title;
    if (args.description !== undefined) data.description = args.description;
    if (args.status !== undefined) data.status = args.status;
    if (args.priority !== undefined) data.priority = args.priority;
    if (args.due_date !== undefined) data.due_at = new Date(args.due_date);
    if (args.assignee_id !== undefined) data.assignee_id = args.assignee_id;
    const task = await this.prisma.task.update({
      where: { id: args.id },
      data,
    });
    return { task };
  }

  private async createDeal(workspaceId: string, args: Record<string, any>) {
    if (!args.title || !args.stage_id) throw new BadRequestException('create_deal requires "title" and "stage_id"');
    const deal = await this.prisma.deal.create({
      data: {
        workspace_id: workspaceId,
        title: args.title,
        stage_id: args.stage_id,
        value: args.value || 0,
        contact_id: args.contact_id || undefined,
        status: 'OPEN',
      },
    });
    return { deal };
  }

  private async moveDeal(workspaceId: string, args: Record<string, any>) {
    if (!args.id || !args.stage_id) throw new BadRequestException('move_deal requires "id" and "stage_id"');
    const deal = await this.prisma.deal.update({
      where: { id: args.id },
      data: { stage_id: args.stage_id },
    });
    return { deal };
  }

  private async listDocuments(workspaceId: string, args: Record<string, any>) {
    const where: any = { workspace_id: workspaceId };
    if (args.search) where.file_name = { contains: args.search, mode: 'insensitive' };
    const docs = await this.prisma.document.findMany({
      where,
      select: { id: true, file_name: true, mime_type: true, file_size: true, ocr_text: true, created_at: true },
      take: 50,
      orderBy: { created_at: 'desc' },
    });
    return { documents: docs };
  }
}
