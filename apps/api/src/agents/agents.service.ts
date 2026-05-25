import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AgentStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  createAgent(workspaceId: string, dto: CreateAgentDto) {
    return this.prisma.agentInstance.create({
      data: {
        workspace_id: workspaceId,
        name: dto.name,
        description: dto.description,
        chatflow_id: dto.chatflow_id ?? "",
        provider: dto.provider,
        channel_scope: dto.channel_scope,
        system_instructions: dto.system_instructions,
        config_json: dto.config_json ?? undefined,
        template_id: dto.template_id,
      },
    });
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
        ...(dto.config_json !== undefined && { config_json: dto.config_json }),
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
    return this.prisma.agentInstance.create({
      data: {
        workspace_id: workspaceId,
        name: template.name,
        description: template.description,
        provider: template.provider,
        chatflow_id: "",
        channel_scope: template.channel_scope,
        system_instructions:
          typeof cfg.system_prompt === "string" ? cfg.system_prompt : null,
        config_json: template.config_json ?? undefined,
        template_id: template.id,
        status: "DRAFT",
      },
    });
  }
}
