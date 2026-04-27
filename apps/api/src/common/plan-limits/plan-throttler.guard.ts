import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

const PLAN_RATE_LIMITS: Record<string, number> = {
  FREE: 60,
  STARTER: 120,
  GROWTH: 300,
  ENTERPRISE: 1000,
};

@Injectable()
export class PlanThrottlerGuard extends ThrottlerGuard {
  constructor(options: any, storageService: any, reflector: any, private readonly prisma: PrismaService) {
    super(options, storageService, reflector);
  }

  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const user = (req as any).user;
    if (user?.workspace_id) {
      return `plan-${user.workspace_id}`;
    }
    return `ip-${req.ip}`;
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = (req as any).user;

    let plan = 'FREE';
    if (user?.workspace_id) {
      try {
        const ws = await this.prisma.workspace.findUnique({
          where: { id: user.workspace_id },
          select: { plan: true },
        });
        plan = ws?.plan || 'FREE';
      } catch {
        // Fallback to FREE on DB error
      }
    }

    const planLimit = PLAN_RATE_LIMITS[plan] ?? PLAN_RATE_LIMITS['FREE'];

    // Temporarily override the throttler limit for this request
    const throttlers = (this as any).throttlers;
    if (throttlers && throttlers.length > 0) {
      throttlers[0].limit = planLimit;
      if (throttlers[1]) throttlers[1].limit = Math.floor(planLimit / 10);
    }

    return super.canActivate(context);
  }
}
