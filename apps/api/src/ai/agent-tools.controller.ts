import { Body, Controller, Post, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AgentToolsService } from './agent-tools.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AgentToolDto } from './agent-tools.dto';

@Controller('agent')
export class AgentToolsController {
  constructor(
    private readonly toolsService: AgentToolsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('tool')
  async execute(@Body() dto: AgentToolDto, @Req() req: any) {
    const auth = req.headers?.authorization || req.headers?.['pymeshub_founder_api_key'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

    if (!process.env.PYMESHUB_FOUNDER_API_KEY) {
      throw new BadRequestException('PYMESHUB_FOUNDER_API_KEY not configured on server');
    }

    if (token !== process.env.PYMESHUB_FOUNDER_API_KEY) {
      throw new UnauthorizedException('Invalid API token');
    }

    let workspaceId: string | null = null;

    if (dto.workspace_slug) {
      const ws = await this.prisma.workspace.findUnique({
        where: { slug: dto.workspace_slug },
        select: { id: true },
      });
      if (!ws) throw new BadRequestException(`Workspace "${dto.workspace_slug}" not found`);
      workspaceId = ws.id;
    } else {
      const slug = req.headers?.['x-workspace-slug'] as string;
      if (slug) {
        const ws = await this.prisma.workspace.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (ws) workspaceId = ws.id;
      }
    }

    if (!workspaceId) {
      throw new BadRequestException('workspace_slug is required. Pass it in the body or x-workspace-slug header.');
    }

    const result = await this.toolsService.execute(workspaceId, dto.tool, dto.arguments || {});
    return result;
  }
}
