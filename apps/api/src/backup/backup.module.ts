import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BackupService } from "./backup.service";
import { BackupController } from "./backup.controller";

@Module({
  imports: [ConfigModule],
  providers: [BackupService],
  controllers: [BackupController],
  exports: [BackupService],
})
export class BackupModule {}
