import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { FilterSummariesDto } from "./dto/filter-summaries.dto";

@Injectable()
export class SummariesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string, filters: FilterSummariesDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { workspace_id: workspaceId };

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
        orderBy: { summary_date: "desc" },
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
      throw new NotFoundException(`No summary found for date ${date} in this workspace`);
    }

    return summary;
  }

  async generate(workspaceId: string) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999,
    );

    const dateRange = {
      gte: startOfDay,
      lte: endOfDay,
    };

    // Gather real metrics from the DB
    const [newConversations, receivedMessages, createdTasks, uploadedDocuments] = await Promise.all(
      [
        this.prisma.conversation.count({
          where: {
            workspace_id: workspaceId,
            created_at: dateRange,
          },
        }),
        this.prisma.message.count({
          where: {
            workspace_id: workspaceId,
            created_at: dateRange,
            direction: "INBOUND",
          },
        }),
        this.prisma.task.count({
          where: {
            workspace_id: workspaceId,
            created_at: dateRange,
          },
        }),
        this.prisma.document.count({
          where: {
            workspace_id: workspaceId,
            created_at: dateRange,
          },
        }),
      ],
    );

    const summaryDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const dateLabel = summaryDate.toLocaleDateString("es-CR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const generated_text = [
      `📅 Resumen del día / Daily Summary — ${dateLabel}`,
      ``,
      `💬 Conversaciones / Conversations: ${newConversations} nueva${newConversations !== 1 ? "s" : ""} hoy / new today`,
      `📨 Mensajes / Messages: ${receivedMessages} recibido${receivedMessages !== 1 ? "s" : ""} / received`,
      `✅ Tareas / Tasks: ${createdTasks} creada${createdTasks !== 1 ? "s" : ""} / created`,
      `📄 Documentos / Documents: ${uploadedDocuments} subido${uploadedDocuments !== 1 ? "s" : ""} / uploaded`,
    ].join("\n");

    const metrics_json = {
      new_conversations: newConversations,
      received_messages: receivedMessages,
      created_tasks: createdTasks,
      uploaded_documents: uploadedDocuments,
    };

    const summary = await this.prisma.dailySummary.upsert({
      where: {
        workspace_id_summary_date: {
          workspace_id: workspaceId,
          summary_date: summaryDate,
        },
      },
      update: {
        generated_text,
        metrics_json: metrics_json as any,
      },
      create: {
        workspace_id: workspaceId,
        summary_date: summaryDate,
        generated_text,
        metrics_json: metrics_json as any,
      },
    });

    return summary;
  }
}
