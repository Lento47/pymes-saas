import { ForbiddenException, Injectable } from "@nestjs/common";
import { AiPurpose } from "./types";

@Injectable()
export class AiOutputGuardService {
  private readonly blockedPatterns: RegExp[] = [
    /system\s+prompt/i,
    /developer\s+message/i,
    /internal\s+instructions/i,
    /api\s*[_-]?\s*key/i,
    /secret/i,
    /token/i,
    /workspace\s*[_-]?\s*id/i,
    /tenant\s+(?:id|internals|isolation|metadata)/i,
  ];

  validate(args: { workspaceId: string; purpose: AiPurpose; output: string }): string {
    const output = args.output ?? "";

    if (!output) {
      return "";
    }

    const shouldBlock = this.blockedPatterns.some((pattern) => pattern.test(output));

    if (shouldBlock) {
      throw new ForbiddenException("AI output blocked because it may expose internal or sensitive information");
    }

    return output;
  }
}
