import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '../queues.constants';

interface AutomationJobData {
  ruleId: string;
  workspaceId: string;
  triggerEntityType: string;
  triggerEntityId: string;
}

interface AutomationAction {
  type: 'set_priority' | 'set_status' | 'assign' | 'create_task' | 'notify';
  priority?: string;
  status?: string;
  user_id?: string;
  title?: string;
  body?: string;
  assigned_user_id?: string;
}

@Injectable()
@Processor(QUEUE_NAMES.AUTOMATION)
export class AutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<AutomationJobData>): Promise<any> {
    const { ruleId, workspaceId, triggerEntityType, triggerEntityId } = job.data;

    this.logger.log(
      `Processing automation job ${job.id} for rule ${ruleId}, entity ${triggerEntityType}:${triggerEntityId}`,
    );

    // 1. Cargar regla
    const rule = await this.prisma.automationRule.findFirst({
      where: { id: ruleId, workspace_id: workspaceId, enabled: true },
    });

    // 2. Si no existe, return
    if (!rule) {
      this.logger.warn(`AutomationRule ${ruleId} not found or disabled, skipping.`);
      return { skipped: true };
    }

    // 3. Crear AutomationExecution con status RUNNING
    const execution = await this.prisma.automationExecution.create({
      data: {
        workspace_id: workspaceId,
        rule_id: ruleId,
        trigger_entity_type: triggerEntityType,
        trigger_entity_id: triggerEntityId,
        status: 'RUNNING',
        input_json: { ruleId, triggerEntityType, triggerEntityId },
        started_at: new Date(),
      },
    });

    try {
      // 4. Evaluar condiciones
      const conditionConfig = rule.condition_config_json as any;
      let conditionMet = true;

      if (conditionConfig && conditionConfig.field && conditionConfig.operator) {
        try {
          const entity = await this.loadEntity(triggerEntityType, triggerEntityId);
          if (entity) {
            conditionMet = this.evaluateCondition(entity, conditionConfig);
          }
        } catch {
          // Si no puede evaluar, la condición pasa
          conditionMet = true;
        }
      }

      // 5. Si condición no se cumple, marcar SKIPPED
      if (!conditionMet) {
        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: { status: 'SKIPPED', finished_at: new Date() },
        });
        this.logger.log(`Automation execution ${execution.id} skipped (condition not met)`);
        return { skipped: true, executionId: execution.id };
      }

      // 6. Ejecutar acciones
      const actions: AutomationAction[] = Array.isArray(rule.action_config_json)
        ? (rule.action_config_json as unknown as AutomationAction[])
        : [];

      for (const action of actions) {
        await this.executeAction(action, triggerEntityType, triggerEntityId, workspaceId);
      }

      // 7. Actualizar execution SUCCESS
      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS',
          finished_at: new Date(),
          output_json: { actions_executed: actions.length },
        },
      });

      this.logger.log(
        `Automation job ${job.id} completed: execution=${execution.id}, actions=${actions.length}`,
      );

      return { executionId: execution.id, actionsExecuted: actions.length };
    } catch (error: any) {
      // 8. En catch: actualizar execution a FAILED antes de re-throw
      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          finished_at: new Date(),
          error_message: error?.message ?? 'Unknown error',
        },
      });

      this.logger.error(
        `Automation job ${job.id} failed: execution=${execution.id}, error=${error?.message}`,
        error?.stack,
      );

      throw error;
    }
  }

  private async loadEntity(entityType: string, entityId: string): Promise<any> {
    switch (entityType) {
      case 'conversation':
        return this.prisma.conversation.findUnique({ where: { id: entityId } });
      case 'task':
        return this.prisma.task.findUnique({ where: { id: entityId } });
      case 'message':
        return this.prisma.message.findUnique({ where: { id: entityId } });
      default:
        return null;
    }
  }

  private evaluateCondition(
    entity: Record<string, any>,
    condition: { field: string; operator: string; value: any },
  ): boolean {
    const { field, operator, value } = condition;
    const entityValue = entity[field];

    switch (operator) {
      case 'eq':
        return entityValue === value;
      case 'neq':
        return entityValue !== value;
      default:
        // Operador desconocido → condición pasa
        return true;
    }
  }

  private async executeAction(
    action: AutomationAction,
    triggerEntityType: string,
    triggerEntityId: string,
    workspaceId: string,
  ): Promise<void> {
    switch (action.type) {
      case 'set_priority':
        if (triggerEntityType === 'conversation') {
          await this.prisma.conversation.update({
            where: { id: triggerEntityId },
            data: { priority: action.priority as any },
          });
        }
        break;

      case 'set_status':
        if (triggerEntityType === 'conversation') {
          await this.prisma.conversation.update({
            where: { id: triggerEntityId },
            data: { status: action.status as any },
          });
        }
        break;

      case 'assign':
        if (triggerEntityType === 'conversation') {
          await this.prisma.conversation.update({
            where: { id: triggerEntityId },
            data: { assigned_user_id: action.user_id ?? null },
          });
        }
        break;

      case 'create_task':
        await this.prisma.task.create({
          data: {
            workspace_id: workspaceId,
            title: action.title ?? 'Tarea automática',
            priority: (action.priority as any) ?? 'MEDIUM',
            status: 'TODO',
            source: 'AUTOMATION',
            conversation_id: triggerEntityType === 'conversation' ? triggerEntityId : undefined,
          },
        });
        break;

      case 'notify':
        if (action.user_id) {
          await this.prisma.notification.create({
            data: {
              workspace_id: workspaceId,
              user_id: action.user_id,
              type: 'automation',
              title: action.title ?? 'Notificación automática',
              body: action.body ?? '',
            },
          });
        }
        break;

      default:
        this.logger.warn(`Unknown action type: ${(action as any).type}`);
    }
  }
}
