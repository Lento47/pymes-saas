import { Injectable, Logger } from "@nestjs/common";

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\bpassword\s*[:=]\s*\S+/i,
];

@Injectable()
export class AgentGuardrailsService {
  private readonly logger = new Logger(AgentGuardrailsService.name);

  apply(text: string, maxChars: number): string {
    let safe = text;

    if (safe.length > maxChars) {
      safe = safe.slice(0, maxChars) + "…";
      this.logger.warn(`Agent response truncated to ${maxChars} chars`);
    }

    for (const re of SENSITIVE_PATTERNS) {
      safe = safe.replace(re, "[REDACTED]");
    }

    return safe;
  }
}
