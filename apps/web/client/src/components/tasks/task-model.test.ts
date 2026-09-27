import { describe, expect, it } from "vitest";
import { taskForm, taskPayload, type TaskRecord } from "./task-model";

const task: TaskRecord = {
  id: "task-a",
  title: "Follow up",
  status: "TODO",
  priority: "HIGH",
  description: "Details",
  assigned_user_id: "member-a",
  due_at: "2026-10-21T18:35:17.000Z",
};

describe("task edit payloads", () => {
  it("preserves the original due instant on unrelated edits", () => {
    const payload = taskPayload(
      { ...taskForm(task), title: "Updated title" },
      task,
    );
    expect(payload).not.toHaveProperty("due_at");
    expect(payload.title).toBe("Updated title");
  });
  it("clears optional fields deliberately", () => {
    expect(
      taskPayload(
        { ...taskForm(task), assignedUserId: "", dueDate: "", description: "" },
        task,
      ),
    ).toMatchObject({ assigned_user_id: null, due_at: null, description: "" });
  });
  it("does not send empty foreign keys or dates when creating", () => {
    const payload = taskPayload({ ...taskForm(), title: " New task " });
    expect(payload.title).toBe("New task");
    expect(payload).not.toHaveProperty("assigned_user_id");
    expect(payload).not.toHaveProperty("due_at");
  });
});
