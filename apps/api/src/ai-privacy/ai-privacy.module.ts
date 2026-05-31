import { Module } from "@nestjs/common";
import { AiAuditLogService } from "./ai-audit-log.service";
import { AiContextMinimizerService } from "./ai-context-minimizer.service";
import { AiOutputGuardService } from "./ai-output-guard.service";
import { AiPrivacyGateway } from "./ai-privacy.gateway";
import { PiiRedactorService } from "./pii-redactor.service";

@Module({
  providers: [
    AiPrivacyGateway,
    PiiRedactorService,
    AiContextMinimizerService,
    AiOutputGuardService,
    AiAuditLogService,
  ],
  exports: [
    AiPrivacyGateway,
    PiiRedactorService,
    AiContextMinimizerService,
    AiOutputGuardService,
    AiAuditLogService,
  ],
})
export class AiPrivacyModule {}
