import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { BackupService } from "./backup.service";
import { PlatformAdminGuard } from "../auth/guards/platform-admin.guard";

@Controller("admin/backup")
@UseGuards(PlatformAdminGuard)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get()
  list() {
    return { data: this.backup.listBackups() };
  }

  @Post("trigger")
  async trigger() {
    return this.backup.runBackup();
  }
}
