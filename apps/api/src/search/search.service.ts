import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SearchService {
  private readonly ALLOWED_TYPES = ['contacts', 'conversations', 'tasks', 'documents'];

  constructor(private readonly prisma: PrismaService) {}

  async search(
    workspaceId: string,
    q: string,
    types: string[],
    limit: number,
  ) {
    // Filter out unknown types to prevent Prisma errors
    const validTypes = types.filter(t => this.ALLOWED_TYPES.includes(t));
    const searches: Promise<any>[] = [];
    const keys: string[] = [];

    if (validTypes.includes('contacts')) {
      keys.push('contacts');
      searches.push(
        this.prisma.contact.findMany({
          take: limit,
          where: {
            workspace_id: workspaceId,
            OR: [
              { full_name: { contains: q } },
              { company_name: { contains: q } },
              { email: { contains: q } },
            ],
          },
        }),
      );
    }

    if (validTypes.includes('conversations')) {
      keys.push('conversations');
      searches.push(
        this.prisma.conversation.findMany({
          take: limit,
          where: {
            workspace_id: workspaceId,
            OR: [
              { subject: { contains: q } },
              { category: { contains: q } },
            ],
          },
        }),
      );
    }

    if (validTypes.includes('tasks')) {
      keys.push('tasks');
      searches.push(
        this.prisma.task.findMany({
          take: limit,
          where: {
            workspace_id: workspaceId,
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
            ],
          },
        }),
      );
    }

    if (validTypes.includes('documents')) {
      keys.push('documents');
      searches.push(
        this.prisma.document.findMany({
          take: limit,
          where: {
            workspace_id: workspaceId,
            OR: [
              { file_name: { contains: q } },
            ],
          },
        }),
      );
    }

    const results = await Promise.all(searches);

    const mapped: Record<string, any[]> = {
      contacts: [],
      conversations: [],
      tasks: [],
      documents: [],
    };

    keys.forEach((key, idx) => {
      mapped[key] = results[idx];
    });

    const total =
      mapped.contacts.length +
      mapped.conversations.length +
      mapped.tasks.length +
      mapped.documents.length;

    return {
      contacts: mapped.contacts,
      conversations: mapped.conversations,
      tasks: mapped.tasks,
      documents: mapped.documents,
      query: q,
      total,
    };
  }
}
