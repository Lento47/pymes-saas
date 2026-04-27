import { Controller, Post, Body, Req, Res, UseGuards, Get, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { PrismaService } from '../common/prisma/prisma.service';

interface McpRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

function sseSend(res: Response, data: any) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

@Controller('mcp')
export class McpController {
  constructor(private readonly prisma: PrismaService) {}
  // Session storage: token hash → workspace slug
  private sessions = new Map<string, string>();

  @Get()
  health() {
    return { status: 'ok', protocol: 'mcp', version: '1.0', tools: TOOLS.length };
  }

  @Get('sse')
  @UseGuards(ApiTokenGuard)
  async sseGet(@Req() req: any, @Res() res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const base = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'api.pymeshub.lat';
    sseSend(res, { jsonrpc: '2.0', result: { endpoint: `${base}://${host}/api/mcp`, ready: true } });
    setTimeout(() => { if (!res.writableEnded) res.end(); }, 3000);
  }

  @Post('sse')
  @UseGuards(ApiTokenGuard)
  async ssePost(@Req() req: any, @Res() res: Response, @Body() body: any) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    if (body.method === 'initialize') {
      sseSend(res, {
        jsonrpc: '2.0', id: body.id,
        result: { protocolVersion: '1.0', capabilities: { tools: {} }, serverInfo: { name: 'PyMesHub', version: '1.0' } },
      });
    } else if (body.method === 'tools/list') {
      sseSend(res, { jsonrpc: '2.0', id: body.id, result: { tools: TOOLS } });
    } else if (body.method === 'tools/call') {
      const result = await this.executeToolCall(req.workspace_id, body.params, body.id, req);
      sseSend(res, result);
    } else if (body.method === 'notifications/initialized') {
      sseSend(res, { jsonrpc: '2.0', id: body.id, result: {} });
    } else {
      sseSend(res, { jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Unknown: ${body.method}` } });
    }

    req.on('close', () => { if (!res.writableEnded) res.end(); });
    setTimeout(() => { if (!res.writableEnded) res.end(); }, 5000);
  }

  @Post()
  @UseGuards(ApiTokenGuard)
  async handle(
    @Req() req: any,
    @Res() res: Response,
    @Body() body: any,
    @Headers('accept') accept?: string,
  ) {
    const isSSE = accept?.includes('text/event-stream');

    // MCP HTTP SSE transport
    if (isSSE) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Handle initialize
      if (body.method === 'initialize') {
        sseSend(res, {
          jsonrpc: '2.0',
          id: body.id,
          result: {
            protocolVersion: '1.0',
            capabilities: { tools: {} },
            serverInfo: { name: 'PyMesHub MCP', version: '1.0' },
          },
        });
      }

      // Handle tools/list
      else if (body.method === 'tools/list') {
        sseSend(res, { jsonrpc: '2.0', id: body.id, result: { tools: TOOLS } });
      }

      // Handle tools/call
      else if (body.method === 'tools/call') {
        const result = await this.executeToolCall(req.workspace_id, body.params, body.id, req);
        sseSend(res, result);
      }

      // Handle notifications/initialized
      else if (body.method === 'notifications/initialized') {
        sseSend(res, { jsonrpc: '2.0', id: body.id, result: {} });
      }

      else {
        sseSend(res, { jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Unknown method: ${body.method}` } });
      }

      res.end();
      return;
    }

    // Plain JSON-RPC fallback
    switch (body.method) {
      case 'initialize':
        return res.json({
          jsonrpc: '2.0', id: body.id,
          result: { protocolVersion: '1.0', capabilities: { tools: {} }, serverInfo: { name: 'PyMesHub MCP', version: '1.0' } },
        });
      case 'tools/list':
        return res.json({ jsonrpc: '2.0', id: body.id, result: { tools: TOOLS } });
      case 'tools/call': {
        const result = await this.executeToolCall(req.workspace_id, body.params, body.id, req);
        return res.json(result);
      }
      default:
        return res.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Unknown method: ${body.method}` } });
    }
  }

  private async executeToolCall(workspaceId: string, params: { name: string; arguments: any }, id: string | number, req: any) {
    const auth = req.headers?.authorization || '';
    const sessionKey = auth.replace(/^Bearer /, '').slice(0, 32);
    try {
      const result = await this.executeTool(workspaceId, params.name, params.arguments || {}, sessionKey);
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } };
    } catch (err: any) {
      return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message } };
    }
  }

  private async executeTool(workspaceId: string, name: string, args: any, sessionKey: string): Promise<any> {
    // Handle set_workspace separately
    if (name === 'set_workspace') {
      const ws = await this.prisma.workspace.findUnique({
        where: { slug: args.slug },
        select: { id: true, name: true, slug: true, plan: true },
      });
      if (!ws) throw new Error(`Workspace "${args.slug}" not found`);
      this.sessions.set(sessionKey, ws.id);
      return { workspace_set: ws };
    }

    // Use stored workspaceId from session if header wasn't provided
    let effectiveWorkspaceId = workspaceId;
    if (!effectiveWorkspaceId && sessionKey) {
      effectiveWorkspaceId = this.sessions.get(sessionKey) || null;
    }
    if (!effectiveWorkspaceId) {
      throw new Error('No workspace set. Use set_workspace tool or x-workspace-slug header.');
    }

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
