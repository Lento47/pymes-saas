import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { InsightsService } from '../insights/insights.service';
import { SearchService } from '../search/search.service';
import { ConversationsService } from '../conversations/conversations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EventsGateway } from '../gateways/events.gateway';

@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    private readonly searchService: SearchService,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversations: ConversationsService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsAppService: WhatsAppService,
    private readonly events: EventsGateway,
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
      case 'resolve_conversation':
        return this.resolveConversation(workspaceId, args);
      case 'update_conversation':
        return this.updateConversation(workspaceId, args);
      case 'assign_conversation':
        return this.assignConversation(workspaceId, args);
      case 'create_conversation':
        return this.createConversation(workspaceId, args);
      case 'add_internal_note':
        return this.addInternalNote(workspaceId, args);
      case 'notify_user':
        return this.notifyUser(workspaceId, args);
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
        throw new Error(`Unknown tool: ${tool}`);
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
    if (!q) throw new Error('search requires a "q" argument');
    const typesArr = args.types ? (args.types as string).split(',').map((t: string) => t.trim()) : [];
    const results = await this.searchService.search(workspaceId, q, typesArr, 10);
    return { results };
  }

  private async getConversationDetail(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    if (!id) throw new Error('get_conversation_detail requires "id" argument');
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
    if (!conv) throw new Error(`Conversation "${id}" not found`);
    return { conversation: conv, messages };
  }

  private async replyConversation(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    const text = args.text || args.message;
    if (!id || !text) throw new Error('reply_conversation requires "id" and "text"');

    const conv = await this.prisma.conversation.findFirst({
      where: { id, workspace_id: workspaceId },
      include: { contact: true, channel: true },
    });
    if (!conv) throw new Error(`Conversation "${id}" not found`);

    const message = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: id,
        direction: 'OUTBOUND',
        body_text: text,
        sender_name: 'HubbyAgent',
        sent_at: new Date(),
      },
    });

    await this.conversations.touchLastMessage(id);
    this.events.emitNewMessage(id, workspaceId, message);

    let dispatched: string | null = null;
    if (conv.channel?.type === 'EMAIL' && (conv.contact as any)?.email) {
      try {
        await this.emailService.sendOutbound(
          conv.channel,
          (conv.contact as any).email,
          (conv as any).subject ?? 'Nuevo mensaje',
          text,
          text,
        );
        dispatched = 'EMAIL';
      } catch (err: any) {
        this.logger.error(`Email dispatch failed: ${err?.message}`);
      }
    } else if (conv.channel?.type === 'WHATSAPP' && (conv.contact as any)?.phone) {
      try {
        const to = ((conv.contact as any).phone as string).replace(/\D/g, '');
        await this.whatsAppService.sendMessage(conv.channel, to, text);
        dispatched = 'WHATSAPP';
      } catch (err: any) {
        this.logger.error(`WhatsApp dispatch failed: ${err?.message}`);
      }
    }

    if (conv.assigned_user_id) {
      this.notifications
        .create(workspaceId, {
          user_id: conv.assigned_user_id,
          type: 'agent_reply',
          title: 'HubbyAgent respondió un caso',
          body: text.slice(0, 140),
          related_entity_type: 'conversation',
          related_entity_id: id,
        })
        .catch((err) => this.logger.error('notify assigned user failed', err));
    }

    return { message, dispatched };
  }

  private async createConversation(workspaceId: string, args: Record<string, any>) {
    const channel_id = args.channel_id;
    if (!channel_id) throw new Error('create_conversation requires "channel_id"');
    const dto: any = {
      channel_id,
      contact_id: args.contact_id || undefined,
      subject: args.subject || undefined,
      priority: args.priority || undefined,
      category: args.category || undefined,
      assigned_user_id: args.assigned_user_id || undefined,
    };
    const conversation = await this.conversations.create(workspaceId, dto);
    return { conversation, opened: true };
  }

  private async addInternalNote(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    const notes = args.notes ?? args.note ?? args.text;
    if (!id || typeof notes !== 'string') {
      throw new Error('add_internal_note requires "id" and "notes"');
    }
    const conversation = await this.conversations.update(workspaceId, id, { notes });
    return { conversation };
  }

  private async notifyUser(workspaceId: string, args: Record<string, any>) {
    const user_id = args.user_id;
    const title = args.title;
    if (!user_id || !title) throw new Error('notify_user requires "user_id" and "title"');

    const member = await this.prisma.workspaceUser.findFirst({
      where: { workspace_id: workspaceId, user_id },
      select: { id: true },
    });
    if (!member) throw new Error(`User "${user_id}" is not a member of this workspace`);

    const notification = await this.notifications.create(workspaceId, {
      user_id,
      type: args.type || 'agent_message',
      title,
      body: args.body ?? '',
      related_entity_type: args.related_entity_type,
      related_entity_id: args.related_entity_id,
    });
    return { notification };
  }

  private async resolveConversation(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    if (!id) throw new Error('resolve_conversation requires "id"');
    const conversation = await this.conversations.resolve(workspaceId, id);
    return { conversation, resolved: true };
  }

  private async assignConversation(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    const userId = args.user_id || args.assigned_user_id;
    if (!id || !userId) throw new Error('assign_conversation requires "id" and "user_id"');
    const conversation = await this.conversations.assign(workspaceId, id, userId);
    return { conversation, assigned: true };
  }

  private async updateConversation(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    if (!id) throw new Error('update_conversation requires "id"');
    if (args.status === 'RESOLVED') {
      const conversation = await this.conversations.resolve(workspaceId, id);
      return { conversation };
    }
    if (args.assigned_user_id) {
      await this.conversations.assign(workspaceId, id, args.assigned_user_id);
    }
    const dto: any = {};
    if (args.status !== undefined && args.status !== null) dto.status = args.status;
    if (args.priority !== undefined && args.priority !== null) dto.priority = args.priority;
    if (args.category !== undefined) dto.category = args.category;
    if (Object.keys(dto).length === 0 && !args.assigned_user_id) {
      throw new Error('update_conversation requires at least one field to change');
    }
    const conversation = Object.keys(dto).length
      ? await this.conversations.update(workspaceId, id, dto)
      : await this.conversations.findOne(workspaceId, id);
    return { conversation };
  }

  private async createAutomation(workspaceId: string, args: Record<string, any>) {
    if (!args.name || !args.trigger_type) {
      throw new Error('create_automation requires "name" and "trigger_type"');
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
    if (!args.id) throw new Error('toggle_automation requires "id"');
    const existing = await this.prisma.automation.findFirst({
      where: { id: args.id, workspace_id: workspaceId },
    });
    if (!existing) throw new Error(`Automation "${args.id}" not found`);
    const updated = await this.prisma.automation.update({
      where: { id: args.id },
      data: { enabled: args.enabled !== undefined ? args.enabled : !existing.enabled },
    });
    return { automation: updated };
  }

  private async updateTask(workspaceId: string, args: Record<string, any>) {
    if (!args.id) throw new Error('update_task requires "id"');
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
    if (!args.title || !args.stage_id) throw new Error('create_deal requires "title" and "stage_id"');
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
    if (!args.id || !args.stage_id) throw new Error('move_deal requires "id" and "stage_id"');
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
