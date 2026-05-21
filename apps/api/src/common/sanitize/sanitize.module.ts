import { Module } from "@nestjs/common";
import { SanitizeService } from "./sanitize.service";

@Module({
  providers: [SanitizeService],
  exports: [SanitizeService],
})
export class SanitizeModule {}
