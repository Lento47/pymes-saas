import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseJsonValue, serializeJson } from '../../common/prisma/enterprise-sqlite-json';

interface AutomationJobData {
  ruleId: string;
  workspaceId: string;
  triggerEntityType: string;
  triggerEntityId: string;
}

interface AutomationAction {
  type: 'set_priority' | 'set_status' | 'assign' | 'create_task' | 'notify' | 'notify_in_app';
  priority?: string;
  status?: string;
  user_id?: string;
  title?: string;
  body?: string;
  assigned_user_id?: string;
  description?: string;
}

@Injectable()
export class AutomationProcessor {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(data: AutomationJobData): Promise<any> {
    const { ruleId, workspaceId, triggerEntityType, triggerEntityId } = data;

    this.logger.log(
      `Processing automation job for rule ${ruleId}, entity ${triggerEntityType}:${triggerEntityId}`,
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
        input_json: serializeJson({ ruleId, triggerEntityType, triggerEntityId }),
        started_at: new Date(),
      },
    });

    try {
      // 4. Evaluar condiciones
      const conditionConfig = parseJsonValue<any>(rule.condition_config_json, null);
      let conditionMet = true;

      const conditions = Array.isArray(conditionConfig)
        ? conditionConfig
        : conditionConfig && conditionConfig.field && conditionConfig.operator
          ? [conditionConfig]
          : [];

      if (conditions.length > 0) {
        try {
          const entity = await this.loadEntity(triggerEntityType, triggerEntityId);
          if (entity) {
            conditionMet = conditions.every((condition) =>
              this.evaluateCondition(entity, condition),
            );
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
      const rawActions = parseJsonValue<any>(rule.action_config_json, null);
      const actions: AutomationAction[] = Array.isArray(rawActions)
        ? (rawActions as AutomationAction[])
        : rawActions && typeof rawActions === 'object'
          ? [rawActions as AutomationAction]
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
          output_json: serializeJson({ actions_executed: actions.length }),
        },
      });

      this.logger.log(
        `Automation completed: execution=${execution.id}, actions=${actions.length}`,
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
        `Automation failed: execution=${execution.id}, error=${error?.message}`,
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
      case 'document':
        return this.prisma.document.findUnique({ where: { id: entityId } });
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
      case 'contains':
        return String(entityValue ?? '').toLowerCase().includes(String(value ?? '').toLowerCase());
      case 'not_contains':
        return !String(entityValue ?? '').toLowerCase().includes(String(value ?? '').toLowerCase());
      case 'gt':
        return Number(entityValue) > Number(value);
      case 'gte':
        return Number(entityValue) >= Number(value);
      case 'lt':
        return Number(entityValue) < Number(value);
      case 'lte':
        return Number(entityValue) <= Number(value);
      case 'exists':
        return value === true
          ? entityValue !== undefined && entityValue !== null && entityValue !== ''
          : entityValue === undefined || entityValue === null || entityValue === '';
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
    const conversationTargetId = await this.resolveConversationTargetId(
      triggerEntityType,
      triggerEntityId,
    );

    switch (action.type) {
      case 'notify_in_app':
        {
          const recipientId = await this.resolveNotificationRecipient(
            workspaceId,
            action.user_id,
            conversationTargetId,
          );

          if (recipientId) {
            await this.prisma.notification.create({
              data: {
                workspace_id: workspaceId,
                user_id: recipientId,
                type: 'automation',
                title: action.title ?? 'Notificación automática',
                body: action.body ?? 'Se ejecutó una automatización.',
                related_entity_type: conversationTargetId ? 'conversation' : triggerEntityType,
                related_entity_id: conversationTargetId ?? triggerEntityId,
              },
            });
          }
        }
        break;

      case 'set_priority':
        if (conversationTargetId) {
          await this.prisma.conversation.update({
            where: { id: conversationTargetId },
            data: { priority: action.priority as any },
          });
        }
        break;

      case 'set_status':
        if (conversationTargetId) {
          await this.prisma.conversation.update({
            where: { id: conversationTargetId },
            data: { status: action.status as any },
          });
        }
        break;

      case 'assign':
        if (conversationTargetId) {
          await this.prisma.conversation.update({
            where: { id: conversationTargetId },
            data: { assigned_user_id: action.user_id ?? null },
          });
        }
        break;

      case 'create_task':
        await this.prisma.task.create({
          data: {
            workspace_id: workspaceId,
            title: action.title ?? 'Tarea automática',
            description: action.description,
            priority: (action.priority as any) ?? 'MEDIUM',
            status: 'TODO',
            source: 'AUTOMATION',
            assigned_user_id: action.assigned_user_id ?? action.user_id,
            conversation_id: conversationTargetId ?? undefined,
          },
        });
        break;

      case 'notify':
        {
          const recipientId = await this.resolveNotificationRecipient(
            workspaceId,
            action.user_id,
            conversationTargetId,
          );

          if (recipientId) {
          await this.prisma.notification.create({
            data: {
              workspace_id: workspaceId,
              user_id: recipientId,
              type: 'automation',
              title: action.title ?? 'Notificación automática',
              body: action.body ?? '',
              related_entity_type: conversationTargetId ? 'conversation' : triggerEntityType,
              related_entity_id: conversationTargetId ?? triggerEntityId,
            },
          });
        }
        }
        break;

      default:
        this.logger.warn(`Unknown action type: ${(action as any).type}`);
    }
  }

  private async resolveConversationTargetId(
    triggerEntityType: string,
    triggerEntityId: string,
  ): Promise<string | null> {
    if (triggerEntityType === 'conversation') {
      return triggerEntityId;
    }

    if (triggerEntityType === 'message') {
      const message = await this.prisma.message.findUnique({
        where: { id: triggerEntityId },
        select: { conversation_id: true },
      });
      return message?.conversation_id ?? null;
    }

    if (triggerEntityType === 'task') {
      const task = await this.prisma.task.findUnique({
        where: { id: triggerEntityId },
        select: { conversation_id: true },
      });
      return task?.conversation_id ?? null;
    }

    if (triggerEntityType === 'document') {
      const document = await this.prisma.document.findUnique({
        where: { id: triggerEntityId },
        select: { conversation_id: true },
      });
      return document?.conversation_id ?? null;
    }

    return null;
  }

  private async resolveNotificationRecipient(
    workspaceId: string,
    explicitUserId?: string,
    conversationId?: string | null,
  ): Promise<string | null> {
    if (explicitUserId) return explicitUserId;

    if (conversationId) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { assigned_user_id: true },
      });
      if (conversation?.assigned_user_id) {
        return conversation.assigned_user_id;
      }
    }

    const ownerMembership = await this.prisma.workspaceUser.findFirst({
      where: { workspace_id: workspaceId, is_owner: true },
      select: { user_id: true },
    });

    return ownerMembership?.user_id ?? null;
  }
}
