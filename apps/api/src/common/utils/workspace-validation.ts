import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function validateWorkspaceResource(
  prisma: PrismaService,
  model: string,
  resourceId: string,
  workspaceId: string,
) {
  const resource = await (prisma as any)[model].findFirst({
    where: { id: resourceId, workspace_id: workspaceId },
  });

  if (!resource) {
    throw new NotFoundException('Resource not found');
  }

  return resource;
}
