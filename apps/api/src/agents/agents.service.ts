import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AgentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { FlowiseClient } from "./flowise/flowise.client";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowise: FlowiseClient,
  ) {}

  listAgents(workspaceId: string) {
    return this.prisma.agentInstance.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "desc" },
    });
  }

  async getAgent(workspaceId: string, id: string) {
    const agent = await this.prisma.agentInstance.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!agent) throw new NotFoundException("Agent not found");
    return agent;
  }

  async createAgent(workspaceId: string, dto: CreateAgentDto) {
    // 1. Persist in DB immediately
    const agent = await this.prisma.agentInstance.create({
      data: {
        workspace_id: workspaceId,
        name: dto.name,
        description: dto.description,
        chatflow_id: dto.chatflow_id ?? "",
        provider: dto.provider,
        channel_scope: dto.channel_scope,
        system_instructions: dto.system_instructions,
        config_json: dto.config_json as Prisma.InputJsonValue,
        template_id: dto.template_id,
      },
    });

    // 2. Auto-provision chatflow in Flowise if not provided manually
    if (this.flowise.isEnabled && !dto.chatflow_id) {
      return this.provisionChatflow(agent.id, dto.name);
    }

    return agent;
  }

  async updateAgent(workspaceId: string, id: string, dto: UpdateAgentDto) {
    await this.getAgent(workspaceId, id);
    return this.prisma.agentInstance.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.chatflow_id !== undefined && { chatflow_id: dto.chatflow_id }),
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.channel_scope !== undefined && {
          channel_scope: dto.channel_scope,
        }),
        ...(dto.system_instructions !== undefined && {
          system_instructions: dto.system_instructions,
        }),
        ...(dto.config_json !== undefined && { config_json: dto.config_json as Prisma.InputJsonValue }),
        ...(dto.voice_enabled !== undefined && { voice_enabled: dto.voice_enabled }),
        ...(dto.elevenlabs_voice_id !== undefined && {
          elevenlabs_voice_id: dto.elevenlabs_voice_id,
        }),
      },
    });
  }

  async setStatus(workspaceId: string, id: string, status: AgentStatus) {
    await this.getAgent(workspaceId, id);
    return this.prisma.agentInstance.update({ where: { id }, data: { status } });
  }

  listTemplates() {
    return this.prisma.agentTemplate.findMany({
      where: { is_published: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
  }

  async installTemplate(workspaceId: string, templateId: string) {
    const template = await this.prisma.agentTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException("Template not found");

    const cfg = (template.config_json ?? {}) as Record<string, unknown>;

    // 1. Create in DB
    const agent = await this.prisma.agentInstance.create({
      data: {
        workspace_id: workspaceId,
        name: template.name,
        description: template.description,
        provider: template.provider,
        chatflow_id: "",
        channel_scope: template.channel_scope,
        system_instructions:
          typeof cfg.system_prompt === "string" ? cfg.system_prompt : null,
        config_json: template.config_json as Prisma.InputJsonValue,
        template_id: template.id,
        status: "DRAFT",
      },
    });

    // 2. Auto-provision chatflow in Flowise
    if (this.flowise.isEnabled) {
      return this.provisionChatflow(agent.id, template.name);
    }

    return agent;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private async provisionChatflow(agentId: string, name: string) {
    try {
      const chatflowId = await this.flowise.createChatflow(name);
      return this.prisma.agentInstance.update({
        where: { id: agentId },
        data: { chatflow_id: chatflowId },
      });
    } catch (err) {
      this.logger.error(
        `Auto-provision Flowise chatflow failed for agent ${agentId}: ${(err as Error).message}`,
      );
      // Return agent with empty chatflow_id — user can retry or set manually
      return this.prisma.agentInstance.findUniqueOrThrow({
        where: { id: agentId },
      });
    }
  }
}
