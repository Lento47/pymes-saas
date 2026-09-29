import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { BackupService } from "./backup.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlatformAdminGuard } from "../auth/guards/platform-admin.guard";

/**
 * Backup listing and manual trigger.
 *
 * `JwtAuthGuard` has to come first and has to be here at all. `PlatformAdminGuard` reads
 * `req.user.is_platform_admin`, and `req.user` is only ever populated by
 * `JwtAuthGuard` — the two global guards (`PlanThrottlerGuard`, `PermissionGuard`) do not
 * attach a user. Without this line the guard read `undefined`, `undefined?.is_platform_admin`
 * was falsy, and **every route below returned 403 for everyone including real platform
 * admins.** The endpoint was not "locked down", it was simply unreachable.
 *
 * Guard order is load-bearing: `PlatformAdminGuard` must never run before the user exists.
 */
@Controller("admin/backup")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
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
