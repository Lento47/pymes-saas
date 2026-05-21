import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { FilterSummariesDto } from './dto/filter-summaries.dto';
import { CloudflareAiService } from '../ai/cloudflare-ai.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class SummariesService {
  private readonly logger = new Logger(SummariesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: CloudflareAiService,
  ) {}

  async findAll(workspaceId: string, filters: FilterSummariesDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { workspace_id: workspaceId };

    if (filters.from || filters.to) {
      where.summary_date = {};
      if (filters.from) {
        where.summary_date.gte = new Date(filters.from);
      }
      if (filters.to) {
        where.summary_date.lte = new Date(filters.to);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.dailySummary.findMany({
        where,
        skip,
        take: limit,
        orderBy: { summary_date: 'desc' },
      }),
      this.prisma.dailySummary.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByDate(workspaceId: string, date: string) {
    const summaryDate = new Date(date);

    const summary = await this.prisma.dailySummary.findFirst({
      where: {
        workspace_id: workspaceId,
        summary_date: summaryDate,
      },
    });

    if (!summary) {
      throw new NotFoundException(
        `No summary found for date ${date} in this workspace`,
      );
    }

    return summary;
  }

  // ── AI-powered generate ──────────────────────────────────────────────────────

  async generate(workspaceId: string) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Gather ALL business data for a comprehensive brief
    const [
      newConversations,
      receivedMessages,
      createdTasks,
      totalContacts,
      activeConversations,
      pendingTasks,
      highPriorityTasks,
      monthlyRevenue,
      outstandingInvoices,
      pipelineStages,
    ] = await Promise.all([
      // Today
      this.prisma.conversation.count({ where: { workspace_id: workspaceId, created_at: { gte: startOfDay } } }),
      this.prisma.message.count({ where: { workspace_id: workspaceId, created_at: { gte: startOfDay }, direction: 'INBOUND' } }),
      this.prisma.task.count({ where: { workspace_id: workspaceId, created_at: { gte: startOfDay } } }),
      // Totals
      this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
      this.prisma.conversation.count({ where: { workspace_id: workspaceId, status: { in: ['NEW', 'OPEN'] } } }),
      this.prisma.task.count({ where: { workspace_id: workspaceId, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
      this.prisma.task.count({ where: { workspace_id: workspaceId, priority: 'HIGH', status: { in: ['TODO', 'IN_PROGRESS'] } } }),
      // Revenue
      this.prisma.invoice.aggregate({
        where: { workspace_id: workspaceId, status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] }, issue_date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      // Outstanding invoices (SENT, PARTIALLY_PAID, OVERDUE)
      this.prisma.invoice.findMany({
        where: { workspace_id: workspaceId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        orderBy: { due_date: 'asc' },
        take: 10,
      }),
      // Pipeline
      this.prisma.dealStage.findMany({
        where: { workspace_id: workspaceId },
        orderBy: { order: 'asc' },
        include: {
          deals: {
            where: { status: 'OPEN' },
            include: { contact: { select: { full_name: true } } },
          },
        },
      }),
    ]);

    // Build data context for AI
    const revenue = monthlyRevenue._sum.amount ?? 0;
    const outstandingTotal = outstandingInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount ?? 0), 0
    );
    const overdueInvoices = outstandingInvoices.filter(
      (inv) => new Date(inv.due_date).getTime() < Date.now()
    );
    const upcomingInvoices = outstandingInvoices.filter(
      (inv) => new Date(inv.due_date).getTime() >= Date.now()
    );

    const pipelineDeals = pipelineStages.reduce(
      (sum, stage) => sum + stage.deals.length, 0
    );
    const pipelineValue = pipelineStages.reduce(
      (sum, stage) => sum + stage.deals.reduce((s, d) => s + Number(d.value ?? 0), 0), 0
    );
    const topStage = [...pipelineStages]
      .filter((s) => !['Ganado', 'Perdido'].includes(s.name))
      .sort((a, b) => b.deals.length - a.deals.length)[0];

    const dataContext = [
      `=== DATOS DEL NEGOCIO PARA HOY ===`,
      `Fecha: ${today.toISOString().split('T')[0]}`,
      ``,
      `--- Ingresos ---`,
      `Ingresos del mes: ₡${revenue.toLocaleString('es-CR')}`,
      `Facturas por cobrar: ${outstandingInvoices.length} (total ₡${outstandingTotal.toLocaleString('es-CR')})`,
      overdueInvoices.length > 0
        ? `Facturas vencidas: ${overdueInvoices.length} — ${overdueInvoices.map(i => `${i.client_name ?? '#' + i.id?.slice(0,6)} (₡${Number(i.amount||0).toLocaleString('es-CR')})`).join(', ')}`
        : 'Sin facturas vencidas.',
      upcomingInvoices.length > 0
        ? `Próximas a vencer: ${upcomingInvoices.slice(0,5).map(i => `${i.client_name ?? '#' + i.id?.slice(0,6)} vence ${new Date(i.due_date).toISOString().split('T')[0]} (₡${Number(i.amount||0).toLocaleString('es-CR')})`).join(', ')}`
        : '',
      ``,
      `--- Pipeline ---`,
      pipelineStages.filter(s => !['Ganado', 'Perdido'].includes(s.name)).map(s =>
        `${s.name}: ${s.deals.length} negocio(s), ₡${s.deals.reduce((sum, d) => sum + Number(d.value ?? 0), 0).toLocaleString('es-CR')}`
      ).join('\n'),
      `Total pipeline activo: ${pipelineDeals} negocios por ₡${pipelineValue.toLocaleString('es-CR')}`,
      topStage ? `Mayor concentración: ${topStage.name}` : '',
      ``,
      `--- Actividad ---`,
      `Conversaciones activas: ${activeConversations}`,
      `Mensajes recibidos hoy: ${receivedMessages}`,
      `Tareas pendientes: ${pendingTasks} (${highPriorityTasks} urgentes)`,
      `Contactos totales: ${totalContacts}`,
    ].filter(Boolean).join('\n');

    const systemPrompt = `Eres un asistente ejecutivo para dueños de pequeñas y medianas empresas en Latinoamérica. Tu tarea es escribir un briefing diario en español claro y directo.

Reglas:
1. Escribe EXACTAMENTE 3-4 oraciones fluidas, no una lista
2. Primera oración: ingresos + facturas por cobrar
3. Segunda oración: pipeline de ventas
4. Tercera oración: actividad del día (mensajes, tareas)
5. Si hay alertas (facturas vencidas, tareas urgentes), agregá UNA oración extra con ⚠️
6. Tono: profesional pero cálido, como un colega de confianza
7. Usá números con formato (₡2.4M en vez de ₡2,400,000)
8. No uses viñetas ni markdown. Solo texto corrido.
9. No inventes datos — usá solo los proporcionados.`;

    const userPrompt = `Escribí el briefing diario con estos datos:\n\n${dataContext}`;

    try {
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ];

      // Use CloudflareAiService directly — bypasses the generic AiService
      const res = await fetch(
        process.env.CLOUDFLARE_AI_CHAT_URL || '',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CLOUDFLARE_AI_TOKEN || ''}`,
          },
          body: JSON.stringify({
            model: '@cf/meta/llama-4-scout-17b-16k-instruct',
            messages,
            max_tokens: 300,
            temperature: 0.4,
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Cloudflare AI error ${res.status}: ${errText}`);
      }

      const json = await res.json() as any;
      const generated_text = json.choices?.[0]?.message?.content?.trim() ?? '';

      if (!generated_text) {
        throw new Error('AI returned empty summary');
      }

      const metrics_json = {
        new_conversations: newConversations,
        received_messages: receivedMessages,
        created_tasks: createdTasks,
        pending_tasks: pendingTasks,
        high_priority_tasks: highPriorityTasks,
        active_conversations: activeConversations,
        monthly_revenue: revenue,
        outstanding_invoices: outstandingInvoices.length,
        outstanding_total: outstandingTotal,
        pipeline_deals: pipelineDeals,
        pipeline_value: pipelineValue,
      };

      const summaryDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const summary = await this.prisma.dailySummary.upsert({
        where: {
          workspace_id_summary_date: {
            workspace_id: workspaceId,
            summary_date: summaryDate,
          },
        },
        update: { generated_text, metrics_json: metrics_json as any },
        create: {
          workspace_id: workspaceId,
          summary_date: summaryDate,
          generated_text,
          metrics_json: metrics_json as any,
        },
      });

      return summary;
    } catch (err) {
      this.logger.error(`Failed to generate AI summary: ${(err as Error).message}`);
      throw err;
    }
  }
}
