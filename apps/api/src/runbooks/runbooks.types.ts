/**
 * A runbook is a pre-approved support action with bounded blast radius.
 * Each runbook is registered in `runbooks.registry.ts` with a static
 * descriptor (metadata visible to support agents) and a runtime executor
 * (the actual side effect, with full DI access).
 *
 * Why not just expose admin endpoints? Two reasons:
 *   1. Audit. Every invocation creates a `runbook_executions` row that
 *      records who, when, against which workspace, with what parameters,
 *      and what the result was. Engineers can replay history.
 *   2. Catalog. A support agent in the UI sees only the runbooks they're
 *      allowed to run, with documented parameters and reversal notes.
 *      Compare with: "find the right admin endpoint and curl it."
 */

import type { PrismaService } from "../common/prisma/prisma.service";

export interface RunbookDescriptor {
  /** Unique key, kebab-case. Used in URLs and as the DB column value. */
  name: string;

  /** Human-readable label shown to support agents in the catalog. */
  title: string;

  /** Short description of what the runbook does. */
  description: string;

  /** What the agent should do if this runbook causes an unintended effect. */
  reversalNotes: string;

  /**
   * Parameter schema. Order matters for documentation. Each param's
   * `key` is what the executor receives in `params`.
   */
  parameters: RunbookParameter[];

  /** Risk classification — used to pick the icon/color in the UI. */
  risk: "low" | "medium" | "high";

  /**
   * Who can invoke this runbook.
   *  - 'platform_admin': only `is_platform_admin = true` users.
   *  - 'workspace_admin': OWNER or ADMIN of the target workspace.
   *
   * The MVP only supports 'platform_admin'; workspace_admin is
   * declared so we can relax the policy per-runbook later without
   * changing the registry shape.
   */
  requiredScope: "platform_admin" | "workspace_admin";
}

export interface RunbookParameter {
  key: string;
  label: string;
  description?: string;
  type: "string" | "uuid";
  required: boolean;
}

/**
 * Inputs received by every runbook executor. The service supplies these
 * after RBAC + parameter validation has passed.
 */
export interface RunbookExecutionContext {
  workspaceId: string;
  executedByUserId: string;
  diagnosticCaseId?: string;
  params: Record<string, string>;
  prisma: PrismaService;
}

/**
 * The result of a runbook execution. The runbook implementer returns
 * this; the service persists it on the `runbook_executions` row.
 */
export interface RunbookExecutionResult {
  /** Human-readable summary; shown in the UI. */
  summary: string;

  /** Optional structured details. Stored verbatim in `result_json`. */
  details?: Record<string, unknown>;
}

/** A runbook executor is the actual side-effect function. */
export type RunbookExecutor = (ctx: RunbookExecutionContext) => Promise<RunbookExecutionResult>;
