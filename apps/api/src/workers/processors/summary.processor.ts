import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { stringifyJson } from '../../common/prisma/json';

@Injectable()
export class SummaryProcessor {
  private readonly logger = new Logger(SummaryProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('55 23 * * *') // 11:55 PM cada día
  async generateDailySummaries(): Promise<void> {
    this.logger.log('Running generateDailySummaries cron job');

    // Obtener todos los workspaces activos
    const workspaces = await this.prisma.workspace.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    this.logger.log(`Generating summaries for ${workspaces.length} active workspaces`);

    for (const workspace of workspaces) {
      try {
        await this.generateWorkspaceSummary(workspace.id);
      } catch (error: unknown) {
        this.logger.error(
          `Failed to generate summary for workspace ${workspace.id}: ${error?.message}`,
          error?.stack,
        );
      }
    }

    this.logger.log('generateDailySummaries cron job finished');
  }

  private async generateWorkspaceSummary(workspaceId: string): Promise<void> {
    const now = new Date();

    // Calcular start y end del día actual
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Contar conversaciones del día
    const conversationsCount = await this.prisma.conversation.count({
      where: {
        workspace_id: workspaceId,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Contar mensajes del día
    const messagesCount = await this.prisma.message.count({
      where: {
        workspace_id: workspaceId,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Contar tareas del día
    const tasksCount = await this.prisma.task.count({
      where: {
        workspace_id: workspaceId,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Contar documentos del día
    const documentsCount = await this.prisma.document.count({
      where: {
        workspace_id: workspaceId,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    const metrics_json = {
      conversations: conversationsCount,
      messages: messagesCount,
      tasks: tasksCount,
      documents: documentsCount,
      generated_at: new Date().toISOString(),
    };

    const generated_text =
      `Resumen del día ${startOfDay.toLocaleDateString('es-CR')} para workspace ${workspaceId}: ` +
      `${conversationsCount} conversaciones, ${messagesCount} mensajes, ` +
      `${tasksCount} tareas, ${documentsCount} documentos procesados.`;

    await this.prisma.dailySummary.upsert({
      where: {
        workspace_id_summary_date: {
          workspace_id: workspaceId,
          summary_date: startOfDay,
        },
      },
      update: {
        generated_text,
        metrics_json: stringifyJson(metrics_json),
      },
      create: {
        workspace_id: workspaceId,
        summary_date: startOfDay,
        generated_text,
        metrics_json: stringifyJson(metrics_json),
      },
    });

    this.logger.log(
      `Summary generated for workspace ${workspaceId}: ${conversationsCount} conversations, ${messagesCount} messages, ${tasksCount} tasks, ${documentsCount} documents`,
    );
  }
}
