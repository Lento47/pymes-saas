import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsageMeteringService } from './usage-metering.service';

@Controller('usage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsageMeteringController {
  constructor(private readonly usageMetering: UsageMeteringService) {}

  @Get(':workspaceId')
  @Roles('OWNER', 'ADMIN')
  async getCurrentUsage(@Param('workspaceId') workspaceId: string) {
    return this.usageMetering.getCurrentUsage(workspaceId);
  }

  @Post(':workspaceId/snapshot')
  @Roles('OWNER', 'ADMIN')
  async createSnapshot(@Param('workspaceId') workspaceId: string) {
    return this.usageMetering.createSnapshot(workspaceId);
  }

  @Get(':workspaceId/history')
  @Roles('OWNER', 'ADMIN')
  async getHistory(@Param('workspaceId') workspaceId: string) {
    return this.usageMetering.getUsageHistory(workspaceId);
  }
}
