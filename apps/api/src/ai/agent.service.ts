import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { parseJsonValue } from '../common/prisma/json';
import { InsightsService } from '../insights/insights.service';
import { SearchService } from '../search/search.service';
import { Agent, tool, run as agentRun, Runner } from '@openai/agents';
import { z } from 'zod';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly insights: InsightsService,
    private readonly searchService: SearchService,
  ) {}

  async getAgentApiKey(workspaceId: string): Promise<string | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const s = parseJsonValue<Record<string, any>>(ws?.settings_json, {});
    if (s.ai_provider === 'openai' && s.ai_api_key_enc) {
      try { return this.crypto.decrypt(s.ai_api_key_enc); }
      catch { this.logger.warn(`No se pudo desencriptar API key del workspace ${workspaceId}`); }
    }
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    return null;
  }

  private createTools(workspaceId: string) {
    const prisma = this.prisma;
    const insights = this.insights;
    const searchSvc = this.searchService;

    return [
      // ── Workspace ──
      tool({
        name: 'get_workspace', description: 'Get current PyMesHub workspace info (name, plan, status)',
        parameters: z.object({}),
        execute: async () => ({ workspace: await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, slug: true, plan: true, status: true, created_at: true } }) }),
      }),
      tool({
        name: 'get_stats', description: 'Get workspace statistics: counts of contacts, tasks, invoices, conversations',
        parameters: z.object({}),
        execute: async () => {
          const [contacts, tasks, invoices, conversations] = await Promise.all([
            prisma.contact.count({ where: { workspace_id: workspaceId } }),
            prisma.task.count({ where: { workspace_id: workspaceId } }),
            prisma.invoice.count({ where: { workspace_id: workspaceId } }),
            prisma.conversation.count({ where: { workspace_id: workspaceId } }),
          ]);
          return { stats: { contacts, tasks, invoices, conversations } };
        },
      }),
      tool({
        name: 'get_insights', description: 'Get AI-generated business insights: trends, risks, recommendations for the workspace',
        parameters: z.object({}),
        execute: async () => ({ insights: await insights.getInsights(workspaceId) }),
      }),
      tool({
        name: 'search', description: 'Full-text search across contacts, conversations, tasks, and documents',
        parameters: z.object({ q: z.string().describe('Search query'), types: z.string().optional().describe('Comma-separated: contact,conversation,task,document') }),
        execute: async ({ q, types }) => {
          const typeArr = types ? types.split(',').map((t: string) => t.trim()) : [];
          return { results: await searchSvc.search(workspaceId, q, typeArr, 10) };
        },
      }),

      // ── Contacts ──
      tool({
        name: 'list_contacts', description: 'List all contacts in the workspace. Optional search filter.',
        parameters: z.object({ search: z.string().optional() }),
        execute: async ({ search }) => {
          const where: any = { workspace_id: workspaceId };
          if (search) where.full_name = { contains: search, mode: 'insensitive' };
          return { contacts: await prisma.contact.findMany({ where, select: { id: true, full_name: true, email: true, phone: true, type: true }, take: 50 }) };
        },
      }),
      tool({
        name: 'create_contact', description: 'Create a new contact in PyMesHub. Requires full_name. Optional: email, phone, company_name, type (CUSTOMER, LEAD, SUPPLIER, PARTNER).',
        parameters: z.object({
          full_name: z.string().describe('Full name of the contact'),
          email: z.string().optional(),
          phone: z.string().optional(),
          company_name: z.string().optional(),
          type: z.enum(['CUSTOMER','LEAD','SUPPLIER','PARTNER']).optional().default('CUSTOMER'),
        }),
        execute: async (args) => ({
          contact: await prisma.contact.create({
            data: {
              workspace_id: workspaceId,
              full_name: args.full_name,
              email: args.email || undefined,
              phone: args.phone || undefined,
              company_name: args.company_name || undefined,
              type: (args.type as any) || 'CUSTOMER',
            },
          }),
        }),
      }),
      tool({
        name: 'update_contact', description: 'Update an existing contact in PyMesHub',
        parameters: z.object({
          id: z.string().describe('Contact ID'),
          full_name: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          company_name: z.string().optional(),
          type: z.enum(['CUSTOMER','LEAD','SUPPLIER','PARTNER']).optional(),
        }),
        execute: async (args) => {
          const data: any = {};
          if (args.full_name !== undefined) data.full_name = args.full_name;
          if (args.email !== undefined) data.email = args.email;
          if (args.phone !== undefined) data.phone = args.phone;
          if (args.company_name !== undefined) data.company_name = args.company_name;
          if (args.type !== undefined) data.type = args.type;
          return { contact: await prisma.contact.update({ where: { id: args.id }, data }) };
        },
      }),

      // ── Tasks ──
      tool({
        name: 'list_tasks', description: 'List all tasks. Filter by status (TODO, IN_PROGRESS, DONE, BLOCKED).',
        parameters: z.object({ status: z.string().optional() }),
        execute: async ({ status }) => {
          const where: any = { workspace_id: workspaceId };
          if (status) where.status = status;
          return { tasks: await prisma.task.findMany({ where, select: { id: true, title: true, status: true, priority: true, due_at: true }, take: 50, orderBy: { created_at: 'desc' } }) };
        },
      }),
      tool({
        name: 'create_task', description: 'Create a new task in the workspace',
        parameters: z.object({ title: z.string(), description: z.string().optional(), priority: z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional().default('MEDIUM'), due_date: z.string().optional() }),
        execute: async (args) => ({
          task: await prisma.task.create({ data: { workspace_id: workspaceId, title: args.title, description: args.description || '', priority: args.priority || 'MEDIUM', due_at: args.due_date ? new Date(args.due_date) : undefined, status: 'TODO' } }),
        }),
      }),
      tool({
        name: 'update_task', description: 'Update an existing task',
        parameters: z.object({ id: z.string(), title: z.string().optional(), description: z.string().optional(), status: z.enum(['TODO','IN_PROGRESS','DONE','BLOCKED']).optional(), priority: z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional(), due_date: z.string().optional() }),
        execute: async (args) => {
          const data: any = {};
          if (args.title !== undefined) data.title = args.title;
          if (args.description !== undefined) data.description = args.description;
          if (args.status !== undefined) data.status = args.status;
          if (args.priority !== undefined) data.priority = args.priority;
          if (args.due_date !== undefined) data.due_at = new Date(args.due_date);
          return { task: await prisma.task.update({ where: { id: args.id }, data }) };
        },
      }),

      // ── Invoices ──
      tool({
        name: 'list_invoices', description: 'List all invoices with amounts, statuses, and due dates',
        parameters: z.object({}),
        execute: async () => ({ invoices: await prisma.invoice.findMany({ where: { workspace_id: workspaceId }, select: { id: true, number: true, amount: true, status: true, due_date: true }, take: 50, orderBy: { created_at: 'desc' } }) }),
      }),

      // ── Conversations ──
      tool({
        name: 'list_conversations', description: 'List conversations. Filter by status (NEW, OPEN, PENDING, RESOLVED, CLOSED).',
        parameters: z.object({ status: z.string().optional() }),
        execute: async ({ status }) => {
          const where: any = { workspace_id: workspaceId };
          if (status) where.status = status;
          return { conversations: await prisma.conversation.findMany({ where, select: { id: true, subject: true, status: true, priority: true, created_at: true }, take: 50, orderBy: { created_at: 'desc' } }) };
        },
      }),
      tool({
        name: 'get_conversation_detail', description: 'Get conversation details and full message history',
        parameters: z.object({ id: z.string() }),
        execute: async ({ id }) => {
          const [conv, messages] = await Promise.all([
            prisma.conversation.findFirst({ where: { id, workspace_id: workspaceId }, select: { id: true, subject: true, status: true, priority: true, category: true, created_at: true, contact: { select: { full_name: true, email: true } } } }),
            prisma.message.findMany({ where: { conversation_id: id, workspace_id: workspaceId }, select: { id: true, direction: true, body_text: true, sender_name: true, sent_at: true }, take: 100, orderBy: { sent_at: 'asc' } }),
          ]);
          if (!conv) throw new Error(`Conversation "${id}" not found`);
          return { conversation: conv, messages };
        },
      }),
      tool({
        name: 'reply_conversation', description: 'Send a reply to a conversation. Use ONLY if user explicitly asks.',
        parameters: z.object({ id: z.string(), text: z.string() }),
        execute: async ({ id, text }) => ({
          message: await prisma.message.create({ data: { workspace_id: workspaceId, conversation_id: id, direction: 'OUTBOUND', body_text: text, sender_name: 'HubbyAgent' } }),
        }),
      }),

      // ── Automations ──
      tool({
        name: 'list_automations', description: 'List all workflow automations and their statuses',
        parameters: z.object({}),
        execute: async () => ({ automations: await prisma.automation.findMany({ where: { workspace_id: workspaceId }, select: { id: true, name: true, enabled: true, trigger_type: true }, take: 50 }) }),
      }),
      tool({
        name: 'create_automation', description: 'Create a new workflow automation rule',
        parameters: z.object({ name: z.string(), trigger_type: z.string(), action_config: z.optional(z.record(z.string(), z.any())), trigger_config: z.optional(z.record(z.string(), z.any())) }),
        execute: async (args) => ({
          automation: await prisma.automation.create({ data: { workspace_id: workspaceId, name: args.name, description: '', trigger_type: args.trigger_type, trigger_config_json: args.trigger_config || {}, action_config_json: args.action_config || {} } }),
        }),
      }),
      tool({
        name: 'toggle_automation', description: 'Enable or disable an automation rule',
        parameters: z.object({ id: z.string(), enabled: z.boolean().optional() }),
        execute: async ({ id, enabled }) => {
          const existing = await prisma.automation.findFirst({ where: { id, workspace_id: workspaceId } });
          if (!existing) throw new Error(`Automation "${id}" not found`);
          return { automation: await prisma.automation.update({ where: { id }, data: { enabled: enabled !== undefined ? enabled : !existing.enabled } }) };
        },
      }),

      // ── Billing (read-only) ──
      tool({
        name: 'get_billing', description: 'Get subscription and billing info (READ-ONLY)',
        parameters: z.object({}),
        execute: async () => {
          const [sub, ws] = await Promise.all([
            prisma.workspaceSubscription.findFirst({ where: { workspace_id: workspaceId }, select: { plan: true, status: true, provider: true, current_period_start: true, current_period_end: true } }),
            prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } }),
          ]);
          return { subscription: sub, workspace_plan: ws?.plan };
        },
      }),
      tool({
        name: 'get_billing_invoices', description: 'Get billing history (READ-ONLY)',
        parameters: z.object({}),
        execute: async () => ({ billing_invoices: await prisma.billingInvoice.findMany({ where: { workspace_id: workspaceId }, select: { id: true, number: true, plan_name: true, total: true, currency: true, status: true, issued_at: true }, take: 50, orderBy: { issued_at: 'desc' } }) }),
      }),

      // ── Pipeline ──
      tool({
        name: 'list_pipeline_deals', description: 'List all sales pipeline deals with stages, values, and statuses',
        parameters: z.object({}),
        execute: async () => ({ deals: await prisma.deal.findMany({ where: { workspace_id: workspaceId }, select: { id: true, title: true, stage_id: true, value: true, status: true }, take: 50, orderBy: { created_at: 'desc' } }) }),
      }),
      tool({
        name: 'create_deal', description: 'Create a new sales pipeline deal',
        parameters: z.object({ title: z.string(), stage_id: z.string(), value: z.number().optional().default(0), contact_id: z.string().optional() }),
        execute: async (args) => ({ deal: await prisma.deal.create({ data: { workspace_id: workspaceId, title: args.title, stage_id: args.stage_id, value: args.value || 0, contact_id: args.contact_id, status: 'OPEN' } }) }),
      }),
      tool({
        name: 'move_deal', description: 'Move a deal to a different pipeline stage',
        parameters: z.object({ id: z.string(), stage_id: z.string() }),
        execute: async ({ id, stage_id }) => ({ deal: await prisma.deal.update({ where: { id }, data: { stage_id } }) }),
      }),

      // ── Documents ──
      tool({
        name: 'list_documents', description: 'List uploaded documents/files with extracted text for insights',
        parameters: z.object({ search: z.string().optional() }),
        execute: async ({ search }) => {
          const where: any = { workspace_id: workspaceId };
          if (search) where.file_name = { contains: search, mode: 'insensitive' };
          return { documents: await prisma.document.findMany({ where, select: { id: true, file_name: true, mime_type: true, file_size: true, ocr_text: true, created_at: true }, take: 50, orderBy: { created_at: 'desc' } }) };
        },
      }),

      // ── Settings ──
      tool({
        name: 'get_settings', description: 'Get workspace settings, members, and roles',
        parameters: z.object({}),
        execute: async () => {
          const [ws, members] = await Promise.all([
            prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, slug: true, plan: true, status: true, locale: true, timezone: true } }),
            prisma.workspaceUser.findMany({ where: { workspace_id: workspaceId }, select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } }, take: 20 }),
          ]);
          return { workspace: ws, members };
        },
      }),
    ];
  }

  async streamWorkflow(
    workspaceId: string,
    input: string,
    conversationId?: string,
  ): Promise<{ stream: ReadableStream; model: string } | { error: string }> {
    const apiKey = await this.getAgentApiKey(workspaceId);
    if (!apiKey) {
      return { error: 'API Key de OpenAI no configurada. Configúrala en Ajustes → IA.' };
    }

    const model = process.env.OPENAI_AGENT_MODEL || 'gpt-4.1';

    // Build context from workspace data
    let inputWithContext = input;
    try {
      const ws = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, plan: true, settings_json: true },
      });
      const s = parseJsonValue<Record<string, any>>(ws?.settings_json, {});
      const agentEnabled = s.ai_agent_enabled === true;

      if (agentEnabled) {
        const [tasks, invoices, contacts] = await Promise.all([
          this.prisma.task.findMany({ where: { workspace_id: workspaceId, status: { in: ['TODO', 'IN_PROGRESS'] } }, select: { title: true, priority: true, status: true, due_at: true }, take: 10, orderBy: { created_at: 'desc' } }),
          this.prisma.invoice.findMany({ where: { workspace_id: workspaceId }, select: { number: true, amount: true, status: true, due_date: true }, take: 5, orderBy: { due_date: 'desc' } }),
          this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
        ]);
        const ctx: string[] = [`Workspace: ${ws?.name} (Plan: ${ws?.plan})`];
        if (tasks.length) ctx.push(`Tareas pendientes: ${tasks.map((t: any) => t.title).join(', ')}`);
        if (invoices.length) ctx.push(`Facturas: ${invoices.map((i: any) => `${i.number} (${i.status})`).join(', ')}`);
        if (contacts) ctx.push(`Contactos totales: ${contacts}`);
        inputWithContext = `Contexto:\n${ctx.join('\n')}\n\nPregunta: ${input}`;
      }
    } catch (err) {
      this.logger.warn(`Error building agent context: ${(err as Error).message}`);
    }

    const tools = this.createTools(workspaceId);

    const agent = new Agent({
      name: 'HubbyAgent',
      instructions: `Eres un ejecutor de operaciones de PyMesHub. Solamente ejecutás acciones usando herramientas. No das consejos, no explicás pasos manuales, no mencionás sistemas externos.

HERRAMIENTAS DISPONIBLES:
create_contact | update_contact | list_contacts
create_task | update_task | list_tasks
create_deal | move_deal | list_pipeline_deals
create_automation | list_automations | toggle_automation
list_invoices | list_conversations | get_conversation_detail | reply_conversation
list_documents | get_stats | get_insights | search
get_billing | get_billing_invoices | get_workspace | get_settings

REGLAS INQUEBRANTABLES:
1. SIEMPRE usas una herramienta. NUNCA das una respuesta sin antes llamar una tool.
2. Si el usuario pide crear/actualizar/eliminar algo, ejecutas la tool inmediatamente con los datos proporcionados.
3. NUNCA explicas "cómo hacerlo". Lo HACES vos con la tool.
4. Si el usuario menciona cualquier cosa fuera de PyMesHub (Hacienda, ATV, SAP, Excel, Android, iPhone, Google, etc.), respondes: "Eso no es parte de PyMesHub. Mis herramientas son: [lista breve de tools]. ¿Qué operación de PyMesHub necesitas?"
5. Si no tenes herramienta para algo, decís: "Esa operación no está disponible en PyMesHub aún."
6. Respuestas en español, máximo 3 oraciones.`,
      model,
      tools,
      modelSettings: { temperature: 0, maxTokens: 1024 },
    });

    const history: any[] = [{ role: 'user', content: inputWithContext }];

    try {
      const runner = new Runner();
      const result = await runner.run(agent, history, { maxTurns: 5 });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const events = (result as any).streamEvents;
            if (typeof events === 'function') {
              for await (const event of events.call(result)) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              }
            }
            const final = await (result.finalOutput || (result as any).output);
            if (final) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response.completed', response: { output_text: typeof final === 'string' ? final : JSON.stringify(final) } })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (err: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: { message: err.message } })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return { stream, model };
    } catch (err: any) {
      this.logger.error(`Agent SDK error: ${err.message}`);
      return { error: `Error del agente: ${err.message}` };
    }
  }

  async streamPublic(
    input: string,
  ): Promise<{ stream: ReadableStream; model: string } | { error: string }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { error: 'OpenAI API key not configured on server.' };
    }

    const agent = new Agent({
      name: 'HubbyLanding',
      instructions: `Eres Hubby 🐾, el asistente virtual de PyMesHub (pymeshub.lat), la plataforma todo-en-uno para PYMEs.

Tu trabajo es ayudar a visitantes a entender qué es PyMesHub y convencerlos de probarla.

⚠️ IMPORTANTE: Respuestas CORTAS (máximo 3-4 oraciones). Sé cálido, directo y entusiasta.

MÓDULOS QUE OFRECE PYMESHUB:
- 📥 Bandeja unificada (WhatsApp, email, chat en un solo lugar)
- 👥 CRM y contactos
- ✅ Tareas y seguimiento
- 📊 Pipeline de ventas
- 🧾 Facturación electrónica (Hacienda Costa Rica)
- 📄 Documentos y archivos
- ⚡ Automatizaciones (workflows sin código)
- 📈 Insights y analíticas con IA
- 🔐 Multi-usuario con roles (OWNER, ADMIN, AGENT, VIEWER)

PLANES: Free (gratis), Starter ($29/mes), Growth ($79/mes), Enterprise (personalizado).

REGLAS:
1. Respuestas de 3-4 oraciones máximo. NUNCA des respuestas largas.
2. Si preguntan por precios, mencioná los planes y dirigilos a pymeshub.lat/pricing.
3. Si preguntan por funcionalidades, describí brevemente el módulo relevante.
4. Si preguntan algo que no sabés, decí "Esa es una excelente pregunta. Te recomiendo visitar pymeshub.lat o contactar a nuestro equipo."
5. Siempre cerrá invitando a registrarse gratis en pymeshub.lat.
6. No inventes features que no existan.
7. No des soporte técnico — para eso deben crear una cuenta.`,
      model: process.env.OPENAI_AGENT_MODEL || 'gpt-4.1-mini',
      tools: [],
      modelSettings: { temperature: 0.4, maxTokens: 200 },
    });

    const history: any[] = [{ role: 'user', content: input }];

    try {
      const runner = new Runner();
      const result = await runner.run(agent, history, { maxTurns: 1 });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const final = await (result.finalOutput || (result as any).output);
            const text = typeof final === 'string' ? final : JSON.stringify(final || '');
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: text })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response.completed', response: { output_text: text } })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (err: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: { message: err.message } })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return { stream, model: 'gpt-4.1-mini' };
    } catch (err: any) {
      this.logger.error(`Public agent error: ${err.message}`);
      return { error: `Error: ${err.message}` };
    }
  }
}
