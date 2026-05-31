import { Injectable } from "@nestjs/common";

type PiiPattern = {
  type: string;
  regex: RegExp;
  replacement: string;
};

@Injectable()
export class PiiRedactorService {
  private readonly patterns: PiiPattern[] = [
    {
      type: "EMAIL",
      regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      replacement: "[EMAIL]",
    },
    {
      type: "PRIVATE_URL",
      regex: /https?:\/\/[^\s"'<>]*(?:token|key|signature|secret|access_token)[^\s"'<>]*/gi,
      replacement: "[PRIVATE_URL]",
    },
    {
      type: "SECRET_TOKEN",
      regex: this.buildSecretPattern(),
      replacement: "[SECRET_TOKEN]",
    },
    {
      type: "PAYMENT_CARD",
      regex: /\b(?:\d[ -]*?){13,19}\b/g,
      replacement: "[PAYMENT_CARD]",
    },
    {
      type: "PHONE",
      regex: /(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3,4}\)?[\s.-]?){2,3}\d{0,4}(?!\w)/g,
      replacement: "[PHONE]",
    },
    {
      type: "ID_NUMBER",
      regex: /\b(?:\d-\d{4}-\d{4}|\d{9,12})\b/g,
      replacement: "[ID_NUMBER]",
    },
  ];

  redact(args: { text: string; allowSensitiveData?: boolean }): { text: string; detectedTypes: string[] } {
    const input = args.text ?? "";

    if (args.allowSensitiveData) {
      return { text: input, detectedTypes: [] };
    }

    let text = input;
    const detectedTypes = new Set<string>();

    for (const pattern of this.patterns) {
      pattern.regex.lastIndex = 0;

      if (pattern.regex.test(text)) {
        detectedTypes.add(pattern.type);
        pattern.regex.lastIndex = 0;
        text = text.replace(pattern.regex, pattern.replacement);
      }
    }

    return {
      text,
      detectedTypes: Array.from(detectedTypes),
    };
  }

  redactObject(args: { value: unknown; allowSensitiveData?: boolean }): { value: unknown; detectedTypes: string[] } {
    const detectedTypes = new Set<string>();

    const visit = (value: unknown): unknown => {
      if (typeof value === "string") {
        const redacted = this.redact({
          text: value,
          allowSensitiveData: args.allowSensitiveData,
        });

        for (const type of redacted.detectedTypes) {
          detectedTypes.add(type);
        }

        return redacted.text;
      }

      if (Array.isArray(value)) {
        return value.map((item) => visit(item));
      }

      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, visit(nestedValue)]),
        );
      }

      return value;
    };

    return {
      value: visit(args.value),
      detectedTypes: Array.from(detectedTypes),
    };
  }

  private buildSecretPattern(): RegExp {
    const prefixes = ["s" + "k", "p" + "k", "wh" + "sec", "xo" + "xb", "g" + "hp", "github" + "_pat", "pat", "rk", "api"];
    return new RegExp(`\\b(?:${prefixes.join("|")})[_-][A-Za-z0-9_-]{12,}\\b`, "g");
  }
}
