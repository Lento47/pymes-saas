import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TemplateService } from './template.service';

@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplateController {
  constructor(private readonly templates: TemplateService) {}

  // ─── System Templates ──────────────────────────────────────────────────

  @Get('system')
  async listSystem(@Query('type') type?: string, @Query('category') category?: string) {
    return this.templates.listSystemTemplates(type, category);
  }

  @Get('system/:id')
  async getSystem(@Param('id') id: string) {
    return this.templates.getSystemTemplate(id);
  }

  @Post('system/:id/instantiate/automation/:workspaceId')
  @Roles('ADMIN', 'OWNER')
  async instantiateAutomation(
    @Param('id') id: string,
    @Param('workspaceId') workspaceId: string,
    @Body() overrides?: Record<string, any>,
  ) {
    return this.templates.instantiateAutomationTemplate(workspaceId, id, overrides);
  }

  @Post('system/:id/instantiate/message/:workspaceId')
  @Roles('ADMIN', 'OWNER')
  async instantiateMessage(
    @Param('id') id: string,
    @Param('workspaceId') workspaceId: string,
    @Body() overrides?: Record<string, any>,
  ) {
    return this.templates.instantiateMessageTemplate(workspaceId, id, overrides);
  }

  // ─── Workspace Templates ───────────────────────────────────────────────

  @Get('workspace')
  async listWorkspace(@Query('industry') industry?: string) {
    return this.templates.listWorkspaceTemplates(industry);
  }

  @Post('workspace/:key/apply/:workspaceId')
  @Roles('OWNER')
  async applyWorkspaceTemplate(
    @Param('key') key: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.templates.applyWorkspaceTemplate(workspaceId, key);
  }
}
