import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  @Get('check/:workspaceId')
  async getAll(@Param('workspaceId') workspaceId: string) {
    return this.featureFlags.getAll(workspaceId);
  }

  @Get('public')
  async getPublic() {
    return this.featureFlags.getPublicFlags();
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  async createFlag(@Body() data: Record<string, any>) {
    return this.featureFlags.upsertFlag(undefined, data);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  async updateFlag(@Param('id') id: string, @Body() data: Record<string, any>) {
    return this.featureFlags.upsertFlag(id, data);
  }

  @Delete(':id')
  @Roles('OWNER')
  async deleteFlag(@Param('id') id: string) {
    return this.featureFlags.deleteFlag(id);
  }
}
