import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FeatureFlagGuard, RequireFeature } from '../feature-flags/feature-flags.guard';
import { MessageTemplatesService } from './message-templates.service';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';

@Controller('message-templates')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
export class MessageTemplatesController {
  constructor(private readonly templates: MessageTemplatesService) {}

  @Get(':workspaceId')
  async list(@Param('workspaceId') workspaceId: string, @Query('channel') channel?: string) {
    return this.templates.list(workspaceId, channel);
  }

  @Get(':workspaceId/approved')
  async getApproved(@Param('workspaceId') workspaceId: string, @Query('channel') channel?: string) {
    return this.templates.getApprovedForChannel(workspaceId, channel ?? 'WHATSAPP');
  }

  @Get(':workspaceId/:id')
  async getById(@Param('workspaceId') workspaceId: string, @Param('id', ValidateUUIDPipe) id: string) {
    return this.templates.getById(workspaceId, id);
  }

  @Post(':workspaceId')
  @RequireFeature('message_templates')
  async create(@Param('workspaceId') workspaceId: string, @Body() data: Record<string, any>, @Req() req: Request) {
    return this.templates.create(workspaceId, (req as any).user?.sub, data);
  }

  @Put(':workspaceId/:id')
  @RequireFeature('message_templates')
  async update(@Param('workspaceId') workspaceId: string, @Param('id', ValidateUUIDPipe) id: string, @Body() data: Record<string, any>) {
    return this.templates.update(workspaceId, id, data);
  }

  @Delete(':workspaceId/:id')
  @RequireFeature('message_templates')
  async delete(@Param('workspaceId') workspaceId: string, @Param('id', ValidateUUIDPipe) id: string) {
    return this.templates.delete(workspaceId, id);
  }
}
