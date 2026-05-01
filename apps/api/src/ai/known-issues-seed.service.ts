import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class KnownIssuesSeedService {
  private readonly logger = new Logger(KnownIssuesSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seed(): Promise<void> {
    const { KNOWN_ISSUES } = await import('./support-known-issues.data');
    let count = 0;
    for (const issue of KNOWN_ISSUES) {
      await (this.prisma as any).supportKnownIssue.upsert({
        where: { error_code: issue.error_code },
        create: {
          error_code: issue.error_code,
          title: issue.title,
          module: issue.module,
          category: issue.category,
          severity: issue.severity,
          description: issue.description,
          workaround: issue.workaround,
          fix_status: issue.fix_status,
          fix_pr_url: issue.fix_pr_url,
          is_active: true,
        },
        update: {
          title: issue.title,
          description: issue.description,
          workaround: issue.workaround,
          fix_status: issue.fix_status,
          fix_pr_url: issue.fix_pr_url,
        },
      });
      count++;
    }
    this.logger.log(`Seeded ${count} known issues`);
  }
}
