import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import type { PrismaService } from "../common/prisma/prisma.service";
import type { AutomationsService } from "../automations/automations.service";
import type { NotificationsService } from "../notifications/notifications.service";
import type { OutcomeTrackerService } from "../learning/outcome-tracker.service";
import type { AuthUser } from "../auth/strategies/jwt.strategy";

describe("task assignment and editable optional fields", () => {
  const prisma = {
    task: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    workspaceUser: { findUnique: jest.fn() },
  };
  const automations = { triggerRules: jest.fn() };
  const service = new TasksService(
    prisma as unknown as PrismaService,
    automations as unknown as AutomationsService,
    {} as NotificationsService,
    {} as OutcomeTrackerService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.task.findFirst.mockResolvedValue({ id: "task-one" });
    prisma.task.create.mockResolvedValue({ id: "task-one" });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
  });

  it("rejects creating or updating with an assignee from another workspace", async () => {
    prisma.workspaceUser.findUnique.mockResolvedValue(null);
    await expect(
      service.create("workspace-a", {} as AuthUser, {
        title: "Call client",
        assigned_user_id: "user-b",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update("workspace-a", "task-one", { assigned_user_id: "user-b" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.create).not.toHaveBeenCalled();
    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(prisma.workspaceUser.findUnique).toHaveBeenCalledWith({
      where: { workspace_id_user_id: { workspace_id: "workspace-a", user_id: "user-b" } },
      select: { user_id: true },
    });
  });

  it("allows an existing member and preserves task creation automation", async () => {
    prisma.workspaceUser.findUnique.mockResolvedValue({ user_id: "member-a" });
    await service.create("workspace-a", {} as AuthUser, {
      title: "Call client",
      assigned_user_id: "member-a",
    });
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspace_id: "workspace-a",
          assigned_user_id: "member-a",
        }),
      }),
    );
    expect(automations.triggerRules).toHaveBeenCalledWith(
      "workspace-a",
      "TASK_CREATED",
      "task",
      "task-one",
    );
  });

  it("clears assignment and due date explicitly without requiring a new assignee", async () => {
    await service.update("workspace-a", "task-one", {
      assigned_user_id: null,
      due_at: null,
      description: "",
    });
    expect(prisma.workspaceUser.findUnique).not.toHaveBeenCalled();
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assigned_user_id: null, due_at: null, description: "" }),
      }),
    );
  });

  it("never updates another workspace's task", async () => {
    prisma.task.findFirst.mockResolvedValue(null);
    await expect(
      service.update("workspace-b", "task-one", { title: "Changed" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task-one", workspace_id: "workspace-b" } }),
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("excludes cancelled work from pending/overdue counts while allowing explicit history", async () => {
    await service.findAll("workspace-a", {});
    await service.findAll("workspace-a", { overdue: "true" });
    await service.getOverdueSummary("workspace-a");
    for (const [query] of prisma.task.findMany.mock.calls) {
      expect(query.where).toMatchObject({
        workspace_id: "workspace-a",
        status: { notIn: ["DONE", "ARCHIVED", "CANCELLED"] },
      });
    }
    prisma.task.findMany.mockClear();
    await service.findAll("workspace-a", { status: "CANCELLED" });
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspace_id: "workspace-a", status: "CANCELLED" } }),
    );
  });
});
