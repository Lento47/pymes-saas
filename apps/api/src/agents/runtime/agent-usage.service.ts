import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AgentChannelScope } from "@prisma/client";

interface RecordUsageOpts {
  workspace_id: string;
  agent_instance_id: string;
  session_id?: string;
  channel: AgentChannelScope;
  input_chars: number;
  output_chars: number;
  latency_ms?: number;
}

@Injectable()
export class AgentUsageService {
  private readonly logger = new Logger(AgentUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(opts: RecordUsageOpts): Promise<void> {
    try {
      await this.prisma.agentUsageEvent.create({ data: opts });
    } catch (err) {
      this.logger.error(
        `Failed to record agent usage: ${(err as Error).message}`,
      );
    }
  }
}
