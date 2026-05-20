import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MessageTemplatesService {
  private readonly logger = new Logger(MessageTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string, channel?: string) {
    return this.prisma.messageTemplate.findMany({
      where: {
        workspace_id: workspaceId,
        ...(channel ? { channel } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async getById(workspaceId: string, id: string) {
    return this.prisma.messageTemplate.findFirst({
      where: { id, workspace_id: workspaceId },
    });
  }

  // TODO(types): create() accepts Record<string,any> instead of a typed DTO.
  // This means unknown keys will be silently ignored or passed to Prisma.
  // Add a CreateMessageTemplateDto with explicit validation.
  async create(workspaceId: string, userId: string, data: Record<string, any>) {
    return this.prisma.messageTemplate.create({
      data: {
        workspace: { connect: { id: workspaceId } },
        channel: data.channel ?? 'WHATSAPP',
        name: data.name,
        external_template_id: data.external_template_id,
        category: data.category,
        language: data.language,
        body: data.body,
        status: data.status ?? 'DRAFT',
        variables: data.variables ?? undefined,
        created_by: data.user_id ? { connect: { id: data.user_id } } : undefined,
      },
    });
  }

  async update(workspaceId: string, id: string, data: Record<string, any>) {
    return this.prisma.messageTemplate.updateMany({
      where: { id, workspace_id: workspaceId },
      data: {
        name: data.name,
        category: data.category,
        language: data.language,
        body: data.body,
        status: data.status,
        variables: data.variables ?? undefined,
      },
    });
  }

  async delete(workspaceId: string, id: string) {
    return this.prisma.messageTemplate.deleteMany({
      where: { id, workspace_id: workspaceId },
    });
  }

  async getApprovedForChannel(workspaceId: string, channel: string) {
    return this.prisma.messageTemplate.findMany({
      where: {
        workspace_id: workspaceId,
        channel,
        status: 'APPROVED',
      },
      orderBy: { name: 'asc' },
    });
  }
}
