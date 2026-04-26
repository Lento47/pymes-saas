import { Controller, Post, Body, Req, UseGuards, Get } from '@nestjs/common';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { PrismaService } from '../common/prisma/prisma.service';

interface McpRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: any;
}

const TOOLS: ToolDef[] = [
  { name: 'get_workspace', description: 'Get current workspace info', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_stats', description: 'Get workspace statistics', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_contacts', description: 'List all contacts', inputSchema: { type: 'object', properties: { search: { type: 'string' } } } },
  { name: 'list_tasks', description: 'List all tasks', inputSchema: { type: 'object', properties: { status: { type: 'string' } } } },
  { name: 'create_task', description: 'Create a new task', inputSchema: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['LOW','MEDIUM','HIGH','URGENT'] }, due_date: { type: 'string' } } } },
  { name: 'list_invoices', description: 'List all invoices', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_conversations', description: 'List all conversations', inputSchema: { type: 'object', properties: { status: { type: 'string' } } } },
  { name: 'list_automations', description: 'List all automations', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_billing', description: 'Get subscription and billing info', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_billing_invoices', description: 'Get billing history invoices', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_pipeline_deals', description: 'List sales pipeline deals', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_settings', description: 'Get workspace settings and members', inputSchema: { type: 'object', properties: {} } },
];

@Controller('mcp')
export class McpController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  health() {
    return { status: 'ok', protocol: 'mcp', version: '1.0', tools: TOOLS.length };
  }

  @Post()
  @UseGuards(ApiTokenGuard)
  async handle(@Req() req: any, @Body() body: McpRequest) {
    const workspaceId = req.workspace_id;

    switch (body.method) {
      case 'tools/list':
        return { jsonrpc: '2.0', result: { tools: TOOLS }, id: body.id };
      case 'tools/call':
        return this.handleCallTool(workspaceId, body.params, body.id);
      default:
        return { jsonrpc: '2.0', error: { code: -32601, message: `Unknown method: ${body.method}` }, id: body.id };
    }
  }

  private async handleCallTool(workspaceId: string, params: { name: string; arguments: any }, id: string | number) {
    if (!workspaceId) {
      return { jsonrpc: '2.0', error: { code: -32000, message: 'Missing x-workspace-slug header' }, id };
    }
    try {
      const result = await this.executeTool(workspaceId, params.name, params.arguments || {});
      return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: JSON.stringify(result) }] }, id };
    } catch (err: any) {
      return { jsonrpc: '2.0', error: { code: -32000, message: err.message }, id };
    }
  }

  private async executeTool(workspaceId: string, name: string, args: any): Promise<any> {
    switch (name) {
      case 'get_workspace': {
        const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, slug: true, plan: true, status: true, created_at: true } });
        return { workspace: ws };
      }
      case 'get_stats': {
        const [contacts, tasks, invoices, conversations] = await Promise.all([
          this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
          this.prisma.task.count({ where: { workspace_id: workspaceId } }),
          this.prisma.invoice.count({ where: { workspace_id: workspaceId } }),
          this.prisma.conversation.count({ where: { workspace_id: workspaceId } }),
        ]);
        return { stats: { contacts, tasks, invoices, conversations } };
      }
      case 'list_contacts': {
        const contacts = await this.prisma.contact.findMany({ where: { workspace_id: workspaceId }, select: { id: true, full_name: true, email: true, phone: true, type: true }, take: 50 });
        return { contacts };
      }
      case 'list_tasks': {
        const where: any = { workspace_id: workspaceId };
        if (args.status) where.status = args.status;
        const tasks = await this.prisma.task.findMany({ where, select: { id: true, title: true, status: true, priority: true, due_at: true }, take: 50, orderBy: { created_at: 'desc' } });
        return { tasks };
      }
      case 'create_task': {
        const task = await this.prisma.task.create({ data: { workspace_id: workspaceId, title: args.title, description: args.description || '', priority: args.priority || 'MEDIUM', due_at: args.due_date ? new Date(args.due_date) : undefined, status: 'TODO' } });
        return { task };
      }
      case 'list_invoices': {
        const invoices = await this.prisma.invoice.findMany({ where: { workspace_id: workspaceId }, select: { id: true, number: true, amount: true, status: true, due_date: true }, take: 50, orderBy: { created_at: 'desc' } });
        return { invoices };
      }
      case 'list_conversations': {
        const where: any = { workspace_id: workspaceId };
        if (args.status) where.status = args.status;
        const conversations = await this.prisma.conversation.findMany({ where, select: { id: true, subject: true, status: true, priority: true, created_at: true }, take: 50, orderBy: { created_at: 'desc' } });
        return { conversations };
      }
      case 'list_automations': {
        const automations = await this.prisma.automation.findMany({ where: { workspace_id: workspaceId }, select: { id: true, name: true, enabled: true, trigger_type: true, action_type: true }, take: 50 });
        return { automations };
      }
      case 'get_billing': {
        const sub = await this.prisma.workspaceSubscription.findFirst({ where: { workspace_id: workspaceId }, select: { plan: true, status: true, provider: true, current_period_start: true, current_period_end: true } });
        const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } });
        return { subscription: sub, workspace_plan: ws?.plan };
      }
      case 'get_billing_invoices': {
        const invoices = await this.prisma.billingInvoice.findMany({ where: { workspace_id: workspaceId }, select: { id: true, number: true, plan_name: true, total: true, currency: true, status: true, issued_at: true }, take: 50, orderBy: { issued_at: 'desc' } });
        return { billing_invoices: invoices };
      }
      case 'list_pipeline_deals': {
        const deals = await this.prisma.deal.findMany({ where: { workspace_id: workspaceId }, select: { id: true, title: true, stage_id: true, value: true, status: true }, take: 50, orderBy: { created_at: 'desc' } });
        return { deals };
      }
      case 'get_settings': {
        const [ws, members] = await Promise.all([
          this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, slug: true, plan: true, status: true, locale: true, timezone: true } }),
          this.prisma.workspaceUser.findMany({ where: { workspace_id: workspaceId }, select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } }, take: 20 }),
        ]);
        return { workspace: ws, members };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
