import { Module, forwardRef } from "@nestjs/common";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";
import { PlatformSettingsService } from "./platform-settings.service";
import { GitHubService } from "./github.service";
import { RailwayService } from "./railway.service";
import { PrismaModule } from "../common/prisma/prisma.module";
import { CryptoModule } from "../common/crypto/crypto.module";
import { FeaturesModule } from "../features/features.module";
import { AuditModule } from "../audit/audit.module";
import { AgentsModule } from "../agents/agents.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [PrismaModule, CryptoModule, FeaturesModule, AuditModule, AgentsModule, forwardRef(() => BillingModule)],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformSettingsService, GitHubService, RailwayService],
  exports: [PlatformSettingsService, GitHubService, RailwayService],
})
export class PlatformModule {}
