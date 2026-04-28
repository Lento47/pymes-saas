import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CloudflareAiService, AssistantMessage } from './cloudflare-ai.service';

class AskDto {
  question: string;
  history?: AssistantMessage[];
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly cloudflareAi: CloudflareAiService) {}

  @Post('assistant')
  @HttpCode(HttpStatus.OK)
  async ask(
    @CurrentUser('workspace_id') _workspaceId: string,
    @Body() body: AskDto,
  ) {
    if (!this.cloudflareAi.isConfigured) {
      return { answer: 'AI assistant is not configured.', sources: [] };
    }
    return this.cloudflareAi.ask(body.question, body.history ?? []);
  }
}
