import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { parseJsonValue } from '../common/prisma/json';
import { InsightsService } from '../insights/insights.service';
import { SearchService } from '../search/search.service';
import { DocsService } from '../docs/docs.service';
import { SupportRouterService, AgentType } from './support-router.service';
import { DiagnosticService } from './diagnostic.service';
import { EngineeringFixService } from './engineering-fix.service';
import { Agent, tool, run as agentRun, Runner } from '@openai/agents';
import { z } from 'zod';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private currentSessionId: string | null = null;

  private static readonly WRITE_TOOLS = new Set([
    'create_contact', 'update_contact', 'create_task', 'update_task',
    'create_deal', 'move_deal', 'reply_conversation',
    'create_automation', 'toggle_automation',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly insights: InsightsService,
    private readonly searchService: SearchService,
    private readonly docsService: DocsService,
    private readonly router: SupportRouterService,
    private readonly diagnostic: DiagnosticService,
    private readonly fixService: EngineeringFixService,
  ) {}

  private async logToolCall(
    agentType: string,
    toolName: string,
    input: Record<string, any>,
    output: Record<string, any>,
    riskLevel: string,
  ): Promise<void> {
    if (!this.currentSessionId) return;
    try {
      await this.prisma.agentToolCall.create({
        data: {
          session_id: this.currentSessionId,
          agent_type: agentType,
          tool_name: toolName,
          input_json: input as any,
          output_json: output as any,
          risk_level: riskLevel,
          allowed: true,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to log tool call ${toolName}: ${(err as Error).message}`);
    }
  }

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

  classifyIntent(input: string): { agent: AgentType; confidence: number } {
    return this.router.classifyIntent(input);
  }

  private createTools(workspaceId: string, agentType: AgentType = 'hubby') {
    const allowedTools = new Set(this.router.getToolSet(agentType));
    const prisma = this.prisma;
    const insights = this.insights;
    const searchSvc = this.searchService;
    const docsSvc = this.docsService;

    return [
      // ── Workspace ──
      tool({
        name: 'get_workspace', description: 'Get current PymesHub workspace info (name, plan, status)',
        parameters: z.object({}),
        execute: async () => ({ workspace: await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, slug: true, plan: true, status: true, created_at: true } }) }),
      }),
      tool({
        name: 'get_stats', description: 'Get workspace statistics: counts of contacts, tasks, invoices, conversations',
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
        parameters: z.object({ title: z.string(), stage_id: z.string(), value: z.number().optional().nullable().default(0), contact_id: z.string().optional().nullable() }),
        execute: async (args) => ({ deal: await prisma.deal.create({ data: { workspace_id: workspaceId, title: args.title, stage_id: args.stage_id, value: args.value || 0, contact_id: args.contact_id, status: 'OPEN' } }) }),
      }),
      tool({
        name: 'move_deal', description: 'Move a deal to a different pipeline stage',
        parameters: z.object({ id: z.string(), stage_id: z.string() }),
        execute: async ({ id, stage_id }) => ({ deal: await prisma.deal.update({ where: { id, workspace_id: workspaceId }, data: { stage_id } }) }),
      }),

      // ── Documents ──
      tool({
        name: 'list_documents', description: 'List uploaded documents/files with extracted text for insights',
        parameters: z.object({ search: z.string().optional().nullable() }),
        execute: async ({ search }) => {
          const where: Record<string, any> = { workspace_id: workspaceId };
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

      // ── Errors ──
      tool({
        name: 'get_errors',
        description: 'Get recent errors from this workspace for diagnostics. Returns error messages, status codes, routes, and timestamps.',
        parameters: z.object({ limit: z.number().optional().describe('Max errors to return (default 10, max 50)') }),
        execute: async ({ limit }: { limit?: number }) => {
          const take = Math.min(limit || 10, 50);
          const errors = await (prisma as any).errorReport.findMany({
            where: { workspace_id: workspaceId },
            select: { id: true, source: true, category: true, severity: true, title: true, message: true, route: true, method: true, status_code: true, occurred_at: true, context_json: true },
            orderBy: { occurred_at: 'desc' },
            take,
          });
          return { errors, count: errors.length };
        },
      }),

      // ── Support / Diagnostics ──
      tool({
        name: 'diagnose',
        description: 'Diagnose a reported error or issue. Returns matched known issues, risk level, category, and fix recommendations.',
        parameters: z.object({ description: z.string().describe('Description of the error or issue to diagnose') }),
        execute: async ({ description }: { description: string }) => {
          const service = this.diagnostic;
          const result = await service.diagnose({ workspaceId, user_description: description });
          return { diagnosis: result };
        },
      }),
      tool({
        name: 'list_diagnostic_cases',
        description: 'List open diagnostic cases for this workspace with statuses and risk levels.',
        parameters: z.object({}),
        execute: async () => {
          const cases = await this.diagnostic.listCases(workspaceId);
          return { diagnostic_cases: cases };
        },
      }),
      tool({
        name: 'list_fix_cases',
        description: 'List engineering fix cases with their status (PENDING, FIX_READY, PENDING_APPROVAL, etc.).',
        parameters: z.object({}),
        execute: async () => {
          const cases = await this.fixService.listFixCases(workspaceId);
          return { fix_cases: cases };
        },
      }),
      tool({
        name: 'approve_fix',
        description: 'Approve a fix case (requires ADMIN role). Changes status from FIX_READY/PENDING_APPROVAL to PR_OPENED.',
        parameters: z.object({ fix_case_id: z.string().describe('The ID of the fix case to approve') }),
        execute: async ({ fix_case_id }: { fix_case_id: string }) => {
          return this.fixService.approveFix(fix_case_id, { workspaceId, isPlatformAdmin: false });
        },
      }),
      tool({
        name: 'reject_fix',
        description: 'Reject a fix case with a reason (requires ADMIN role). Resets to PENDING status.',
        parameters: z.object({ fix_case_id: z.string().describe('The ID of the fix case to reject'), reason: z.string().optional().describe('Why the fix was rejected') }),
        execute: async ({ fix_case_id, reason }: { fix_case_id: string; reason?: string }) => {
          return this.fixService.rejectFix(fix_case_id, reason || '', { workspaceId, isPlatformAdmin: false });
        },
      }),

      // ── Docs ──
      tool({
        name: 'search_PymesHub_docs',
        description: 'Search official PymesHub documentation for help articles, guides, policies, and product information. Use this when the user asks how something works or needs documentation.',
        parameters: z.object({ query: z.string().describe('Search query for PymesHub documentation') }),
        execute: async ({ query }: { query: string }) => {
          const results = docsSvc.search(query);
          return { query, results, total: results.length };
        },
      }),
    ].filter((t: Record<string, any>) => allowedTools.has(t.name));
  }

  async streamWorkflow(
    workspaceId: string,
    input: string,
    conversationId?: string,
    agentType: AgentType = 'hubby',
  ): Promise<{ stream: ReadableStream; model: string; agent_type: string } | { error: string }> {
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
          this.prisma.invoice.findMany({ where: { workspace_id: workspaceId }, select: { number: true, amount: true, subtotal: true, tax_rate: true, tax_amount: true, status: true, due_date: true }, take: 5, orderBy: { due_date: 'desc' } }),
          this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
        ]);
        const ctx: string[] = [`Workspace: ${ws?.name} (Plan: ${ws?.plan})`];
        if (tasks.length) ctx.push(`Tareas pendientes: ${tasks.map((t: Record<string, any>) => t.title).join(', ')}`);
          if (invoices.length) ctx.push(`Facturas: ${invoices.map((i: Record<string, any>) => `${i.number} (${i.status}) total:${i.amount} subtotal:${i.subtotal ?? i.amount} iva:${i.tax_rate ?? 0}%`).join(', ')}`);
        if (contacts) ctx.push(`Contactos totales: ${contacts}`);
        inputWithContext = `Contexto:\n${ctx.join('\n')}\n\nPregunta: ${input}`;
      }
    } catch (err) {
      this.logger.warn(`Error building agent context: ${(err as Error).message}`);
    }

    const tools = this.createTools(workspaceId, agentType);

    // Create agent session for audit trail
    const session = await this.prisma.agentSession.create({
      data: { workspace_id: workspaceId, agent_type: agentType, status: 'ACTIVE' },
    });
    this.currentSessionId = session.id;

    const agent = new Agent({
      name: 'HubbyAgent',
      instructions: `Eres HubbyAgent de PymesHub. Si el usuario pide CREAR, ACTUALIZAR, ELIMINAR o CONSULTAR datos, usás tus herramientas. Si solo saluda o conversa, respondés normal.

HERRAMIENTAS DE DATOS (solo para operaciones CRUD):
create_contact(full_name*, email?, phone?, type?) | update_contact(id*, ...) | list_contacts(search?)
create_task(title*, description?, priority?, due_date?) | update_task(id*, ...) | list_tasks(status?)
create_deal(title*, stage_id*, value?, contact_id?) | move_deal(id*, stage_id*) | list_pipeline_deals()
create_automation(name*, trigger_type*) | list_automations() | toggle_automation(id*)
list_invoices() | list_conversations(status?) | get_conversation_detail(id*) | reply_conversation(id*, text*)
list_documents(search?) | get_stats() | get_insights() | search(q*)
get_billing(), get_billing_invoices() [READ ONLY] | get_workspace() | get_settings()

HERRAMIENTAS DE SOPORTE (diagnóstico y arreglos):
diagnose(description) — analiza un error y encuentra casos conocidos
list_diagnostic_cases() — lista casos de diagnóstico abiertos
list_fix_cases() — lista casos de arreglo con su estado
approve_fix(fix_case_id*) — aprueba un arreglo propuesto
reject_fix(fix_case_id*, reason) — rechaza un arreglo con motivo

REGLAS:
1. Si el usuario reporta un error → USÁ diagnose(). No expliques cómo arreglarlo manualmente.
2. Si el usuario pide ver casos de diagnóstico → USÁ list_diagnostic_cases().
3. Si el usuario pide ver arreglos disponibles → USÁ list_fix_cases().
4. Si el usuario pide aprobar/rechazar un arreglo → USÁ approve_fix() o reject_fix().
5. Para crear/leer/actualizar/eliminar datos → USÁ LA TOOL. No expliques cómo hacerlo.
6. Si el usuario solo saluda o charla → respondé amablemente en 1-2 oraciones en español.
7. NUNCA menciones Android, iPhone, Google, Gmail, Outlook, Excel, ATV, Hacienda, Zapier, IFTTT.
8. Si mencionan algo externo → "Eso no es parte de PymesHub. ¿Qué operación de PymesHub necesitas?"
9. Respuestas en español.`,
      model,
      tools,
      modelSettings: { temperature: 0.2, maxTokens: 1024 },
    });

    const history: any[] = [{ role: 'user', content: inputWithContext }];

    try {
      const runner = new Runner();
      const result = await runner.run(agent, history, { maxTurns: 3 });

      // Extract text from result
      const finalOutput: string = (() => {
        const fo = (result as any).finalOutput;
        if (typeof fo === 'string') return fo;
        if (fo && typeof fo === 'object' && typeof fo.text === 'string') return fo.text;
        if (fo) return JSON.stringify(fo);
        const out = (result as any).output;
        if (typeof out === 'string') return out;
        return '';
      })();

      this.logger.log(`Agent response length: ${finalOutput.length}, preview: ${finalOutput.slice(0, 100)}`);

      // Log tool calls from agent result
      try {
        const rawItems = (result as any).rawResponses ?? (result as any).newItems ?? [];
        for (const item of rawItems) {
          if (item.type === 'function_call' || item.type === 'function_call_output') {
            const toolName = item.name || item.function_name || 'unknown';
            const isWrite = AgentService.WRITE_TOOLS.has(toolName);
            await this.logToolCall('hubby', toolName,
              item.arguments ? JSON.parse(typeof item.arguments === 'string' ? item.arguments : '{}') : {},
              item.output || item.return_value || {},
              isWrite ? 'medium' : 'low',
            );
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to extract tool calls: ${(err as Error).message}`);
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const output = finalOutput || '¡Hola! Soy Hubby, tu asistente de PymesHub. ¿En qué puedo ayudarte?';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: output })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response.completed', response: { output_text: output } })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: { message: err.message } })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return { stream, model, agent_type: agentType };
    } catch (err) {
      this.logger.error(`Agent SDK error: ${err.message}`);
      return { error: `Error del agente: ${err.message}` };
    }
  }

  async streamPublic(
    input: string,
  ): Promise<{ stream: ReadableStream; model: string; agent_type: string } | { error: string }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { error: 'OpenAI API key not configured on server.' };
    }

    const agent = new Agent({
      name: 'HubbyLanding',
      instructions: `Eres Hubby 🐾, el asistente virtual de PymesHub (PymesHub.lat), la plataforma todo-en-uno para PYMEs.

Tu trabajo es ayudar a visitantes a entender qué es PymesHub y convencerlos de probarla.

⚠️ IMPORTANTE: Respuestas CORTAS (máximo 3-4 oraciones). Sé cálido, directo y entusiasta.

MÓDULOS QUE OFRECE PymesHub:
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
2. Si preguntan por precios, mencioná los planes y dirigilos a PymesHub.lat/pricing.
3. Si preguntan por funcionalidades, describí brevemente el módulo relevante.
4. Si preguntan algo que no sabés, decí "Esa es una excelente pregunta. Te recomiendo visitar PymesHub.lat o contactar a nuestro equipo."
5. Siempre cerrá invitando a registrarse gratis en PymesHub.lat.
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
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: { message: err.message } })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return { stream, model: 'gpt-4.1-mini', agent_type: 'hubby' };
    } catch (err) {
      this.logger.error(`Public agent error: ${err.message}`);
      return { error: `Error: ${err.message}` };
    }
  }
}
