/**
 * Shared AI gating logic — used by PolicyEngine, FlowiseAutoReply, and triggerEmrendeAutoReply.
 *
 * HUMAN_ACTIVE blocks AI replies, but only for a configurable timeout after handover.
 * After the timeout (or if ai_always_respond is true), the AI resumes automatically.
 */

const DEFAULT_HANDOVER_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

/** Workspace-level AI settings read from settings_json */
export interface AiGatingSettings {
  /** If true, the AI responds to EVERY message regardless of ai_state. No blocking. */
  ai_always_respond?: boolean;
  /** Milliseconds before AI auto-resumes after human takeover. 0 = never. Default: 180000 */
  human_handover_timeout_ms?: number;
}

/**
 * Returns true if the AI should be blocked because a human recently took over.
 *
 * Respects workspace settings:
 * - ai_always_respond = true  → never blocked (AI responds to everything)
 * - human_handover_timeout_ms → custom timeout (default 3 min, 0 = never auto-resume)
 */
export function isAiBlockedByHuman(
  meta: Record<string, unknown>,
  settings?: AiGatingSettings,
): boolean {
  // ai_always_respond overrides everything — AI never blocked
  if (settings?.ai_always_respond) return false;

  if (meta.ai_state !== "HUMAN_ACTIVE") return false;

  const timeout = settings?.human_handover_timeout_ms ?? DEFAULT_HANDOVER_TIMEOUT_MS;
  if (timeout === 0) return true; // never auto-resume

  const handoverAt = meta.human_handover_at as string | undefined;
  if (!handoverAt) return true; // legacy: no timestamp → block indefinitely

  const elapsed = Date.now() - new Date(handoverAt).getTime();
  return elapsed < timeout;
}

/**
 * Returns true if the handover has expired (> timeout) — AI should resume.
 */
export function isHandoverExpired(
  meta: Record<string, unknown>,
  settings?: AiGatingSettings,
): boolean {
  if (meta.ai_state !== "HUMAN_ACTIVE") return false;

  const timeout = settings?.human_handover_timeout_ms ?? DEFAULT_HANDOVER_TIMEOUT_MS;
  if (timeout === 0) return false; // never auto-resume

  const handoverAt = meta.human_handover_at as string | undefined;
  if (!handoverAt) return false; // legacy: no timestamp → never auto-resume

  return Date.now() - new Date(handoverAt).getTime() >= timeout;
}

/**
 * Parse workspace settings_json into AiGatingSettings.
 * Safe — returns empty object on null/missing.
 */
export function parseAiSettings(settingsJson: unknown): AiGatingSettings {
  const s = (settingsJson as Record<string, unknown>) ?? {};
  return {
    ai_always_respond: s.ai_always_respond === true,
    human_handover_timeout_ms:
      typeof s.human_handover_timeout_ms === "number" ? s.human_handover_timeout_ms : undefined,
  };
}
