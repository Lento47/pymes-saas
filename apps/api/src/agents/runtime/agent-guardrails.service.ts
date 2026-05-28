import { Injectable, Logger } from "@nestjs/common";

/**
 * Secrets / credentials that must never leave the system, whether in a model
 * prompt, a tool result, or a user-facing response.
 */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9]{16,}\b/g, // OpenAI-style API keys
  /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi, // Bearer tokens
  /\beyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g, // JWT
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^\s"']+/gi, // DB URLs
  /\b[A-Za-z0-9_]*(?:api[_-]?key|secret|token|password|webhook[_-]?secret|refresh[_-]?token|access[_-]?token)[A-Za-z0-9_]*\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi,
  /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}\b/g, // GitHub tokens
];

/** PII that should be redacted when the channel/context does not require it. */
const PII_PATTERNS: RegExp[] = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // card-like numbers
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN-like
];

/**
 * Heuristics for prompt-injection attempts embedded in external content.
 * We do not block on these (false positives are common) — we flag them so the
 * runtime can audit and the agent prompt can be reminded to treat them as data.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all |any |the )?(?:previous|above|prior) instructions/i,
  /disregard (?:all |the )?(?:previous|above|system) (?:instructions|prompt)/i,
  /you are now (?:a |an )?[a-z]/i,
  /system prompt/i,
  /reveal (?:your |the )?(?:prompt|instructions|system)/i,
  /\b(?:override|bypass) (?:the )?(?:rules|guardrails|policy|security)\b/i,
];

@Injectable()
export class AgentGuardrailsService {
  private readonly logger = new Logger(AgentGuardrailsService.name);

  /**
   * Backward-compatible entry point used by the existing runtime.
   * Truncates and redacts a model response before it reaches the user.
   */
  apply(text: string, maxChars: number): string {
    return this.sanitizeOutputAfterModel(text, maxChars);
  }

  /**
   * Sanitize untrusted input (user message + operational context) before it is
   * sent to the model. Redacts secrets so they can never be echoed back, and
   * caps size to bound prompt cost.
   */
  sanitizeInputBeforeModel(text: string, maxChars: number): string {
    let safe = this.redactSecrets(text ?? "");
    if (safe.length > maxChars) {
      safe = safe.slice(0, maxChars) + "…";
    }
    return safe;
  }

  /** Sanitize a model response before it reaches the user. */
  sanitizeOutputAfterModel(text: string, maxChars: number): string {
    let safe = text ?? "";
    if (safe.length > maxChars) {
      safe = safe.slice(0, maxChars) + "…";
      this.logger.warn(`Agent response truncated to ${maxChars} chars`);
    }
    safe = this.redactSecrets(safe);
    safe = this.redactPii(safe);
    return safe;
  }

  /** Sanitize the result of a tool call before it is fed back into the model. */
  sanitizeToolResult(text: string, maxChars: number): string {
    let safe = this.redactSecrets(text ?? "");
    if (safe.length > maxChars) {
      safe = safe.slice(0, maxChars) + "…";
    }
    return safe;
  }

  /** Redact secrets/credentials. Always safe to call. */
  redactSecrets(text: string): string {
    let safe = text;
    for (const re of SECRET_PATTERNS) {
      safe = safe.replace(re, "[REDACTED_SECRET]");
    }
    return safe;
  }

  /** Redact PII (card/SSN-like numbers). */
  redactPii(text: string): string {
    let safe = text;
    for (const re of PII_PATTERNS) {
      safe = safe.replace(re, "[REDACTED]");
    }
    return safe;
  }

  /**
   * Detect a likely prompt-injection attempt in external content.
   * Returns the matched marker (for audit) or null. Non-blocking by design.
   */
  detectPromptInjectionAttempt(text: string): string | null {
    for (const re of INJECTION_PATTERNS) {
      const m = (text ?? "").match(re);
      if (m) return m[0];
    }
    return null;
  }
}
