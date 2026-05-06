import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EnterpriseService } from './enterprise.service';

@Controller('enterprise')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

  // ─── Workspace enterprise config ─────────────────────────────────────

  @Get('config/:workspaceId')
  @Roles('OWNER', 'ADMIN')
  async getConfig(@Param('workspaceId') workspaceId: string) {
    return this.enterprise.getConfig(workspaceId);
  }

  @Put('config/:workspaceId')
  @Roles('OWNER', 'ADMIN')
  async upsertConfig(@Param('workspaceId') workspaceId: string, @Body() data: any) {
    return this.enterprise.upsertConfig(workspaceId, data);
  }

  @Delete('config/:workspaceId')
  @Roles('OWNER')
  async deleteConfig(@Param('workspaceId') workspaceId: string) {
    await this.enterprise.deleteConfig(workspaceId);
    return { deleted: true };
  }

  // ─── Capabilities admin ──────────────────────────────────────────────

  @Get('capabilities')
  @Roles('OWNER', 'ADMIN')
  async getCapabilities() {
    return this.enterprise.getCapabilities();
  }

  @Post('capabilities')
  @Roles('OWNER', 'ADMIN')
  async createCapability(@Body() data: any) {
    return this.enterprise.upsertCapability(undefined, data);
  }

  @Put('capabilities/:id')
  @Roles('OWNER', 'ADMIN')
  async updateCapability(@Param('id') id: string, @Body() data: any) {
    return this.enterprise.upsertCapability(id, data);
  }
}
