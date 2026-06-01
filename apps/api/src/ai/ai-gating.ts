/**
 * Shared AI gating logic — used by PolicyEngine, FlowiseAutoReply, and triggerEmrendeAutoReply.
 *
 * HUMAN_ACTIVE blocks AI replies, but only for 3 minutes after handover.
 * After the timeout, the AI resumes automatically.
 */

const HANDOVER_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Returns true if the AI should be blocked because a human recently took over.
 * After HANDOVER_TIMEOUT_MS, the block expires and AI can resume.
 */
export function isAiBlockedByHuman(meta: Record<string, unknown>): boolean {
  if (meta.ai_state !== "HUMAN_ACTIVE") return false;

  const handoverAt = meta.human_handover_at as string | undefined;
  if (!handoverAt) return true; // legacy: no timestamp → block indefinitely

  const elapsed = Date.now() - new Date(handoverAt).getTime();
  return elapsed < HANDOVER_TIMEOUT_MS;
}

/**
 * Returns true if the handover has expired (> 3 minutes) — AI should resume.
 */
export function isHandoverExpired(meta: Record<string, unknown>): boolean {
  if (meta.ai_state !== "HUMAN_ACTIVE") return false;

  const handoverAt = meta.human_handover_at as string | undefined;
  if (!handoverAt) return false; // legacy: no timestamp → never auto-resume

  return Date.now() - new Date(handoverAt).getTime() >= HANDOVER_TIMEOUT_MS;
}
