import { Injectable, ExecutionContext, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerException } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";

const PLAN_RATE_LIMITS: Record<string, number> = {
  FREE:          60,
  EMPRENDE:     300,
  STARTER:      600,
  GROWTH:      1500,
  BUSINESS:    4000,
  ENTERPRISE:  4000, // Legacy → mismo que BUSINESS
  BUSINESS_PLUS: 10_000,
};

@Injectable()
export class PlanThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(PlanThrottlerGuard.name);

  constructor(
    options: unknown,
    storageService: unknown,
    reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(options as any, storageService as any, reflector);
  }

  protected override async getTracker(req: Record<string, string>): Promise<string> {
    const user = (req as Record<string, { workspace_id?: string }>).user;
    if (user?.workspace_id) {
      return `plan-${user.workspace_id}`;
    }
    return `ip-${req.ip}`;
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { workspace_id?: string } }>();
    const user = req.user;

    let plan = "FREE";
    if (user?.workspace_id) {
      try {
        const ws = await this.prisma.workspace.findUnique({
          where: { id: user.workspace_id },
          select: { plan: true },
        });
        plan = ws?.plan || "FREE";
        if (plan === "ENTERPRISE") plan = "BUSINESS";
      } catch {
        // Fallback a FREE en error de DB
      }
    }

    const planLimit = PLAN_RATE_LIMITS[plan] ?? PLAN_RATE_LIMITS["FREE"];

    const throttlers = (this as unknown as { throttlers?: Array<{ limit: number }> }).throttlers;
    if (throttlers && throttlers.length > 0) {
      throttlers[0].limit = planLimit;
    }

    return super.canActivate(context);
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: Record<string, unknown>,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<{
      ip?: string;
      user?: { workspace_id?: string; id?: string };
      url?: string;
    }>();

    this.logger.warn(
      `[rate-limit] 429 workspace=${req.user?.workspace_id ?? "anon"} ip=${req.ip} url=${req.url}`,
    );

    const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
    const timeToExpire = (throttlerLimitDetail as { timeToExpire?: number }).timeToExpire ?? 60;
    res.setHeader("Retry-After", String(timeToExpire));

    throw new ThrottlerException();
  }
}
