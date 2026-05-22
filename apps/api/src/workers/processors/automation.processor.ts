import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { ConversationStatus, Priority } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { EmrendeAiService } from "../../ai/emprende-ai.service";
import { stringifyJson } from "../../common/prisma/json";
import { QUEUE_NAMES } from "../queues.constants";

interface AutomationJobData {
  ruleId: string;
  workspaceId: string;
  triggerEntityType: string;
  triggerEntityId: string;
}

interface AutomationAction {
  type: "set_priority" | "set_status" | "assign" | "create_task" | "notify" | "notify_in_app" | "ai_auto_reply" | "ai_create_task";
  priority?: string;
  status?: string;
  user_id?: string;
  title?: string;
  body?: string;
  assigned_user_id?: string;
  description?: string;
}

@Injectable()
@Processor(QUEUE_NAMES.AUTOMATION)
export class AutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly emprendeAi: EmrendeAiService,
  ) {
    super();
  }

  async process(job: Job<AutomationJobData>): Promise<Record<string, unknown>> {
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
        status: "RUNNING",
        input_json: stringifyJson({ ruleId, triggerEntityType, triggerEntityId }),
        started_at: new Date(),
      },
    });

    try {
      // 4. Evaluar condiciones
      const conditionConfig = rule.condition_config_json as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | null;
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
              this.evaluateCondition(
                entity,
                condition as { field: string; operator: string; value: unknown },
              ),
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
          data: { status: "SKIPPED", finished_at: new Date() },
        });
        this.logger.log(`Automation execution ${execution.id} skipped (condition not met)`);
        return { skipped: true, executionId: execution.id };
      }

      // 6. Ejecutar acciones
      const rawActions = rule.action_config_json as unknown as
        | AutomationAction
        | AutomationAction[]
        | null;
      const actions: AutomationAction[] = Array.isArray(rawActions)
        ? (rawActions as AutomationAction[])
        : rawActions && typeof rawActions === "object"
          ? [rawActions as AutomationAction]
          : [];

      for (const action of actions) {
        await this.executeAction(
          action,
          triggerEntityType,
          triggerEntityId,
          workspaceId,
          rule.name,
        );
      }

      // 7. Actualizar execution SUCCESS
      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: "SUCCESS",
          finished_at: new Date(),
          output_json: stringifyJson({ actions_executed: actions.length }),
        },
      });

      this.logger.log(
        `Automation job ${job.id} completed: execution=${execution.id}, actions=${actions.length}`,
      );

      return { executionId: execution.id, actionsExecuted: actions.length };
    } catch (error: unknown) {
      // 8. En catch: actualizar execution a FAILED antes de re-throw
      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          finished_at: new Date(),
          error_message: (error as Error)?.message ?? "Unknown error",
        },
      });

      this.logger.error(
        `Automation job ${job.id} failed: execution=${execution.id}, error=${(error as Error)?.message}`,
        (error as Error)?.stack,
      );

      throw error;
    }
  }

  private async loadEntity(
    entityType: string,
    entityId: string,
  ): Promise<Record<string, unknown> | null> {
    switch (entityType) {
      case "conversation":
        return this.prisma.conversation.findUnique({ where: { id: entityId } });
      case "task":
        return this.prisma.task.findUnique({ where: { id: entityId } });
      case "message":
        return this.prisma.message.findUnique({ where: { id: entityId } });
      case "document":
        return this.prisma.document.findUnique({ where: { id: entityId } });
      default:
        return null;
    }
  }

  private evaluateCondition(
    entity: Record<string, unknown>,
    condition: { field: string; operator: string; value: unknown },
  ): boolean {
    const { field, operator, value } = condition;
    const entityValue = entity[field];

    switch (operator) {
      case "eq":
        return entityValue === value;
      case "neq":
        return entityValue !== value;
      case "contains":
        return String(entityValue ?? "")
          .toLowerCase()
          .includes(String(value ?? "").toLowerCase());
      case "not_contains":
        return !String(entityValue ?? "")
          .toLowerCase()
          .includes(String(value ?? "").toLowerCase());
      case "gt":
        return Number(entityValue) > Number(value);
      case "gte":
        return Number(entityValue) >= Number(value);
      case "lt":
        return Number(entityValue) < Number(value);
      case "lte":
        return Number(entityValue) <= Number(value);
      case "exists":
        return value === true
          ? entityValue !== undefined && entityValue !== null && entityValue !== ""
          : entityValue === undefined || entityValue === null || entityValue === "";
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
    ruleName: string,
  ): Promise<void> {
    const conversationTargetId = await this.resolveConversationTargetId(
      triggerEntityType,
      triggerEntityId,
    );

    switch (action.type) {
      case "notify_in_app":
        {
          const recipientId = await this.resolveNotificationRecipient(
            workspaceId,
            action.user_id,
            conversationTargetId,
          );

          if (recipientId) {
            const actionDesc = this.describeAction(action);
            await this.notificationsService.create(workspaceId, {
              user_id: recipientId,
              type: "automation",
              title: action.title ?? ruleName,
              body: action.body ?? `${ruleName}: ${actionDesc}`,
              related_entity_type: conversationTargetId ? "conversation" : triggerEntityType,
              related_entity_id: conversationTargetId ?? triggerEntityId,
            });
          }
        }
        break;

      case "set_priority":
        if (conversationTargetId) {
          await this.prisma.conversation.update({
            where: { id: conversationTargetId },
            data: { priority: action.priority as Priority },
          });
        }
        break;

      case "set_status":
        if (conversationTargetId) {
          await this.prisma.conversation.update({
            where: { id: conversationTargetId },
            data: { status: action.status as ConversationStatus },
          });
        }
        break;

      case "assign":
        if (conversationTargetId) {
          await this.prisma.conversation.update({
            where: { id: conversationTargetId },
            data: { assigned_user_id: action.user_id ?? null },
          });
        }
        break;

      case "create_task":
        await this.prisma.task.create({
          data: {
            workspace_id: workspaceId,
            title: action.title ?? "Tarea automática",
            description: action.description,
            priority: (action.priority as Priority) ?? "MEDIUM",
            status: "TODO",
            source: "AUTOMATION",
            assigned_user_id: action.assigned_user_id ?? action.user_id,
            conversation_id: conversationTargetId ?? undefined,
          },
        });
        break;

      case "notify":
        {
          const recipientId = await this.resolveNotificationRecipient(
            workspaceId,
            action.user_id,
            conversationTargetId,
          );

          if (recipientId) {
            const actionDesc = this.describeAction(action);
            await this.notificationsService.create(workspaceId, {
              user_id: recipientId,
              type: "automation",
              title: action.title ?? ruleName,
              body: action.body ?? `${ruleName}: ${actionDesc}`,
              related_entity_type: conversationTargetId ? "conversation" : triggerEntityType,
              related_entity_id: conversationTargetId ?? triggerEntityId,
            });
          }
        }
        break;

      case "ai_auto_reply": {
        const ok = await this.checkEmprendePlan(workspaceId);
        if (!ok) {
          this.logger.warn(`ai_auto_reply skipped — workspace ${workspaceId} not on EMPRENDE+ plan`);
          break;
        }
        if (conversationTargetId) {
          const msg = await this.prisma.message.findFirst({
            where: { conversation_id: conversationTargetId, direction: "INBOUND" },
            orderBy: { sent_at: "desc" },
            select: { body_text: true },
          });
          if (msg?.body_text) {
            const reply = await this.emprendeAi.generateReply(
              workspaceId,
              conversationTargetId,
              msg.body_text,
            );
            await this.prisma.message.create({
              data: {
                workspace_id: workspaceId,
                conversation_id: conversationTargetId,
                direction: "OUTBOUND",
                sender_name: "Asistente IA",
                sender_ref: "ai@emprende",
                body_text: reply,
                sent_at: new Date(),
                delivery_status: "SENT",
                message_type: "TEXT",
                has_media: false,
                media_status: "NONE",
              },
            });
            await this.prisma.conversation.update({
              where: { id: conversationTargetId },
              data: { last_message_at: new Date(), updated_at: new Date() },
              select: { id: true },
            });
          }
        }
        break;
      }

      case "ai_create_task": {
        const ok = await this.checkEmprendePlan(workspaceId);
        if (!ok) {
          this.logger.warn(`ai_create_task skipped — workspace ${workspaceId} not on EMPRENDE+ plan`);
          break;
        }
        const msg = conversationTargetId
          ? await this.prisma.message.findFirst({
              where: { conversation_id: conversationTargetId, direction: "INBOUND" },
              orderBy: { sent_at: "desc" },
              select: { body_text: true },
            })
          : null;
        if (msg?.body_text) {
          const suggestions = await this.emprendeAi.suggestTasksFromMessage(
            workspaceId,
            msg.body_text,
          );
          for (const s of suggestions) {
            await this.prisma.task.create({
              data: {
                workspace_id: workspaceId,
                title: s.title,
                description: s.description,
                priority: s.priority as Priority,
                status: "TODO",
                source: "AUTOMATION",
                conversation_id: conversationTargetId ?? undefined,
              },
            });
          }
        }
        break;
      }

      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
    }
  }

  private async checkEmprendePlan(workspaceId: string): Promise<boolean> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });
    const EMPRENDE_PLUS = ["EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
    return EMPRENDE_PLUS.includes(ws?.plan ?? "");
  }

  private describeAction(action: AutomationAction): string {
    switch (action.type) {
      case "set_priority":
        return `Cambió prioridad a ${action.priority}`;
      case "set_status":
        return `Cambió estado a ${action.status}`;
      case "assign":
        return `Asignó conversación`;
      case "create_task":
        return `Creó tarea: ${action.title ?? ""}`;
      case "notify":
        return "Notificación enviada";
      case "notify_in_app":
        return "Notificación en app";
      case "ai_auto_reply":
        return "Respuesta automática IA enviada";
      case "ai_create_task":
        return "Tareas IA creadas desde mensaje";
      default:
        return `Acción: ${action.type}`;
    }
  }

  private async resolveConversationTargetId(
    triggerEntityType: string,
    triggerEntityId: string,
  ): Promise<string | null> {
    if (triggerEntityType === "conversation") {
      return triggerEntityId;
    }

    if (triggerEntityType === "message") {
      const message = await this.prisma.message.findUnique({
        where: { id: triggerEntityId },
        select: { conversation_id: true },
      });
      return message?.conversation_id ?? null;
    }

    if (triggerEntityType === "task") {
      const task = await this.prisma.task.findUnique({
        where: { id: triggerEntityId },
        select: { conversation_id: true },
      });
      return task?.conversation_id ?? null;
    }

    if (triggerEntityType === "document") {
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
