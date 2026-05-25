import { PlaybookExecutionService } from "./playbook-execution.service";
import { EmprendePlaybookOutput } from "./emprende-playbooks.service";

describe("PlaybookExecutionService", () => {
  function makeOutput(overrides: Partial<EmprendePlaybookOutput> = {}): EmprendePlaybookOutput {
    return {
      intent: "support_faq",
      reply: "Respuesta",
      requiredFields: ["question_context"],
      escalationRequired: false,
      capabilityTier: "BASIC",
      allowedActions: ["intent_classification"],
      forbiddenActions: ["invent_prices"],
      ...overrides,
    };
  }

  it("persists runbook execution audit record", async () => {
    const create = jest.fn().mockResolvedValue({ id: "run_123" });
    const prisma = { runbookExecution: { create } } as any;
    const service = new PlaybookExecutionService(prisma);

    const result = await service.persistExecution({
      workspaceId: "ws_1",
      message: "hola",
      output: makeOutput(),
    });

    expect(result).toEqual({ runbookExecutionId: "run_123" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("creates escalation task only when escalation is required", async () => {
    const create = jest.fn().mockResolvedValue({ id: "task_1" });
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { task: { create, findFirst } } as any;
    const service = new PlaybookExecutionService(prisma);

    const withEscalation = await service.createEscalationTask({
      workspaceId: "ws_1",
      message: "ya pagué",
      conversationId: "conv_1",
      output: makeOutput({ intent: "payment_reported", escalationRequired: true }),
    });
    const withoutEscalation = await service.createEscalationTask({
      workspaceId: "ws_1",
      message: "horario",
      conversationId: "conv_2",
      output: makeOutput({ escalationRequired: false }),
    });

    expect(withEscalation).toEqual({ taskId: "task_1" });
    expect(withoutEscalation).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("updates existing open escalation task instead of creating duplicates", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "task_existing" });
    const update = jest.fn().mockResolvedValue({ id: "task_existing" });
    const create = jest.fn();
    const prisma = { task: { findFirst, update, create } } as any;
    const service = new PlaybookExecutionService(prisma);

    const result = await service.createEscalationTask({
      workspaceId: "ws_1",
      message: "quiero humano",
      conversationId: "conv_1",
      output: makeOutput({ intent: "human_handoff", escalationRequired: true }),
    });

    expect(result).toEqual({ taskId: "task_existing" });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });
});
