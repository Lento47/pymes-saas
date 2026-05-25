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
    const prisma = { task: { create } } as any;
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
});
