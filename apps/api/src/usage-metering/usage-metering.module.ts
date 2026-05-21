import { Module } from "@nestjs/common";
import { UsageMeteringService } from "./usage-metering.service";
import { UsageMeteringController } from "./usage-metering.controller";

@Module({
  providers: [UsageMeteringService],
  controllers: [UsageMeteringController],
  exports: [UsageMeteringService],
})
export class UsageMeteringModule {}
