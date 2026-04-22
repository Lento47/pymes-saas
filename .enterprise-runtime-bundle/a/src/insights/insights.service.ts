import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export type InsightSeverity = 'danger' | 'warning' | 'positive' | 'info';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  suggestion: string;
  value?: number;
  change_pct?: number;
  change_label?: string;
}

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getInsights(workspaceId: string): Promise<Insight[]> {
    const now = new Date();

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      thisMonthConvs,
      lastMonthConvs,
      thisMonthMsgs,
      lastMonthMsgs,
      thisMonthTasksDone,
      lastMonthTasksDone,
      thisMonthContacts,
      lastMonthContacts,
      unresolvedConvs,
      overdueTasks,
      activeTasks,
      unassignedOpenConvs,
      urgentConvs,
    ] = await Promise.all([
      this.prisma.conversation.count({
        where: { workspace_id: workspaceId, created_at: { gte: thisMonthStart } },
      }),
      this.prisma.conversation.count({
        where: { workspace_id: workspaceId, created_at: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      this.prisma.message.count({
        where: { workspace_id: workspaceId, direction: 'INBOUND', created_at: { gte: thisMonthStart } },
      }),
      this.prisma.message.count({
        where: { workspace_id: workspaceId, direction: 'INBOUND', created_at: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      this.prisma.task.count({
        where: { workspace_id: workspaceId, status: 'DONE', completed_at: { gte: thisMonthStart } },
      }),
      this.prisma.task.count({
        where: { workspace_id: workspaceId, status: 'DONE', completed_at: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      this.prisma.contact.count({
        where: { workspace_id: workspaceId, created_at: { gte: thisMonthStart } },
      }),
      this.prisma.contact.count({
        where: { workspace_id: workspaceId, created_at: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      this.prisma.conversation.count({
        where: { workspace_id: workspaceId, status: { in: ['NEW', 'OPEN', 'PENDING'] } },
      }),
      this.prisma.task.count({
        where: {
          workspace_id: workspaceId,
          status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
          due_at: { lt: now },
        },
      }),
      this.prisma.task.count({
        where: { workspace_id: workspaceId, status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] } },
      }),
      this.prisma.conversation.count({
        where: {
          workspace_id: workspaceId,
          assigned_user_id: null,
          status: { in: ['NEW', 'OPEN'] },
        },
      }),
      this.prisma.conversation.count({
        where: { workspace_id: workspaceId, priority: 'URGENT', status: { in: ['NEW', 'OPEN', 'PENDING'] } },
      }),
    ]);

    const insights: Insight[] = [];

    // 1. Conversation volume trend
    if (lastMonthConvs > 0) {
      const pct = Math.round(((thisMonthConvs - lastMonthConvs) / lastMonthConvs) * 100);
      if (pct >= 20) {
        insights.push({
          id: 'conv_volume_up',
          severity: 'warning',
          title: `Este mes recibiste un ${pct}% más de conversaciones que el mes pasado.`,
          suggestion: `Considera reforzar tu equipo de atención o activar respuestas automáticas para reducir tiempos de espera.`,
          value: thisMonthConvs,
          change_pct: pct,
          change_label: 'vs. mes pasado',
        });
      } else if (pct <= -20) {
        insights.push({
          id: 'conv_volume_down',
          severity: 'info',
          title: `Este mes tuviste un ${Math.abs(pct)}% menos de conversaciones que el mes pasado.`,
          suggestion: `Es un buen momento para hacer seguimiento proactivo a clientes inactivos o lanzar una campaña de reactivación.`,
          value: thisMonthConvs,
          change_pct: pct,
          change_label: 'vs. mes pasado',
        });
      }
    }

    // 2. Unresolved conversations
    if (unresolvedConvs >= 10) {
      insights.push({
        id: 'unresolved_convs',
        severity: unresolvedConvs >= 20 ? 'danger' : 'warning',
        title: `Tienes ${unresolvedConvs} conversaciones sin resolver acumuladas.`,
        suggestion: `Asigna responsables a las conversaciones sin dueño y prioriza las marcadas como URGENT para reducir el backlog.`,
        value: unresolvedConvs,
      });
    }

    // 3. Overdue tasks
    if (overdueTasks > 0 && activeTasks > 0) {
      const overdueRate = Math.round((overdueTasks / activeTasks) * 100);
      if (overdueRate >= 30) {
        insights.push({
          id: 'overdue_tasks_high',
          severity: 'danger',
          title: `El ${overdueRate}% de tus tareas activas están vencidas (${overdueTasks} de ${activeTasks}).`,
          suggestion: `Revisa la distribución de carga entre agentes. Si una persona tiene demasiadas tareas, redistribúyelas o ajusta las fechas límite.`,
          value: overdueTasks,
          change_pct: overdueRate,
          change_label: 'de tareas vencidas',
        });
      } else if (overdueRate >= 10) {
        insights.push({
          id: 'overdue_tasks_medium',
          severity: 'warning',
          title: `Tienes ${overdueTasks} tarea${overdueTasks > 1 ? 's' : ''} vencida${overdueTasks > 1 ? 's' : ''} sin completar.`,
          suggestion: `Dedica 15 minutos hoy a revisar y completar o reprogramar estas tareas antes de que afecten la atención al cliente.`,
          value: overdueTasks,
        });
      }
    }

    // 4. Message volume trend
    if (lastMonthMsgs > 0) {
      const pct = Math.round(((thisMonthMsgs - lastMonthMsgs) / lastMonthMsgs) * 100);
      if (pct >= 25) {
        insights.push({
          id: 'msg_volume_up',
          severity: 'info',
          title: `El volumen de mensajes entrantes subió un ${pct}% respecto al mes pasado.`,
          suggestion: `Revisa si hay preguntas frecuentes repetidas. Crear respuestas rápidas o una automatización para esas consultas te ahorrará mucho tiempo.`,
          value: thisMonthMsgs,
          change_pct: pct,
          change_label: 'vs. mes pasado',
        });
      }
    }

    // 5. Task completion rate trend
    if (lastMonthTasksDone > 0) {
      const pct = Math.round(((thisMonthTasksDone - lastMonthTasksDone) / lastMonthTasksDone) * 100);
      if (pct >= 15) {
        insights.push({
          id: 'task_completion_up',
          severity: 'positive',
          title: `¡Excelente! Completaste un ${pct}% más de tareas que el mes pasado.`,
          suggestion: `Tu equipo está siendo más productivo. Es un buen momento para revisar los procesos que están funcionando y replicarlos.`,
          value: thisMonthTasksDone,
          change_pct: pct,
          change_label: 'vs. mes pasado',
        });
      } else if (pct <= -20) {
        insights.push({
          id: 'task_completion_down',
          severity: 'warning',
          title: `La cantidad de tareas completadas bajó un ${Math.abs(pct)}% respecto al mes pasado.`,
          suggestion: `Verifica si hay tareas bloqueadas o mal definidas. Reuniones cortas de seguimiento pueden ayudar a destrabar el equipo.`,
          value: thisMonthTasksDone,
          change_pct: pct,
          change_label: 'vs. mes pasado',
        });
      }
    }

    // 6. Unassigned open conversations
    if (unassignedOpenConvs >= 5) {
      insights.push({
        id: 'unassigned_convs',
        severity: 'warning',
        title: `Hay ${unassignedOpenConvs} conversaciones abiertas sin un agente asignado.`,
        suggestion: `Asigna estas conversaciones manualmente o configura una regla de automatización para distribución automática por canal o horario.`,
        value: unassignedOpenConvs,
      });
    }

    // 7. Urgent conversations
    if (urgentConvs >= 3) {
      insights.push({
        id: 'urgent_convs',
        severity: 'danger',
        title: `Tienes ${urgentConvs} conversaciones marcadas como URGENTE sin resolver.`,
        suggestion: `Atiende estas conversaciones de inmediato. Cada minuto de demora en casos urgentes puede impactar la relación con el cliente.`,
        value: urgentConvs,
      });
    }

    // 8. New contacts growth
    if (thisMonthContacts > 0 && lastMonthContacts > 0) {
      const pct = Math.round(((thisMonthContacts - lastMonthContacts) / lastMonthContacts) * 100);
      if (pct >= 20) {
        insights.push({
          id: 'contacts_growth',
          severity: 'positive',
          title: `Agregaste un ${pct}% más de contactos nuevos este mes (${thisMonthContacts} en total).`,
          suggestion: `El negocio está creciendo. Asegúrate de que cada nuevo contacto tenga una conversación de bienvenida o seguimiento asignado.`,
          value: thisMonthContacts,
          change_pct: pct,
          change_label: 'vs. mes pasado',
        });
      }
    } else if (thisMonthContacts > 0 && lastMonthContacts === 0) {
      insights.push({
        id: 'contacts_first_month',
        severity: 'positive',
        title: `Registraste ${thisMonthContacts} contacto${thisMonthContacts > 1 ? 's' : ''} nuevo${thisMonthContacts > 1 ? 's' : ''} este mes.`,
        suggestion: `Buen arranque. Asegúrate de completar la información de cada contacto para poder segmentarlos y hacer seguimiento efectivo.`,
        value: thisMonthContacts,
      });
    }

    // Sort: danger first, then warning, then info/positive
    const order: Record<InsightSeverity, number> = { danger: 0, warning: 1, positive: 2, info: 3 };
    insights.sort((a, b) => order[a.severity] - order[b.severity]);

    return insights.slice(0, 6);
  }
}
