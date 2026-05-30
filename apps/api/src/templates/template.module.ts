import { Module, OnModuleInit } from "@nestjs/common";
import { TemplateService } from "./template.service";
import { TemplateController } from "./template.controller";
import { MessageTemplatesSeed } from "./message-templates.seed";

@Module({
  providers: [TemplateService, MessageTemplatesSeed],
  controllers: [TemplateController],
  exports: [TemplateService],
})
export class TemplateModule implements OnModuleInit {
  constructor(private readonly seed: MessageTemplatesSeed) {}

  async onModuleInit() {
    await this.seed.seed();
  }
}
