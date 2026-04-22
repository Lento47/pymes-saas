import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PERMISSIONS_METADATA_KEY } from '../decorators/require-permission.decorator';
import {
  PermissionKey,
  hasPermission,
} from '../permissions/permission.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { id: string; workspace_id: string; role: string };

    if (!user) throw new ForbiddenException('No autenticado.');
    if (user.role === 'OWNER') return true;

    // Load overrides fresh so revocations take effect without re-login.
    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: user.workspace_id,
          user_id: user.id,
        },
      },
      select: { permissions_json: true, role: true },
    });

    if (!membership) throw new ForbiddenException('Sin acceso a este workspace.');

    const overrides = (membership.permissions_json as Record<string, boolean> | null) ?? null;

    for (const key of required) {
      if (!hasPermission(membership.role, overrides, key)) {
        throw new ForbiddenException(
          `Te falta el permiso "${key}" para realizar esta acción.`,
        );
      }
    }

    return true;
  }
}
