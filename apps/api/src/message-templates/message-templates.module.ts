import { Module } from "@nestjs/common";
import { MessageTemplatesService } from "./message-templates.service";
import { MessageTemplatesController } from "./message-templates.controller";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";

@Module({
  imports: [FeatureFlagsModule],
  providers: [MessageTemplatesService],
  controllers: [MessageTemplatesController],
  exports: [MessageTemplatesService],
})
export class MessageTemplatesModule {}
