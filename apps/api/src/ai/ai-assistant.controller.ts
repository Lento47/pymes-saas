import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';

@Controller('workspaces/current/ai')
@UseGuards(JwtAuthGuard)
export class AiAssistantController {
  constructor(
    private readonly planLimits: PlanLimitsService,
  ) {}

  @Post('assist')
  async assist(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() body: { input: string },
  ) {
    await this.planLimits.enforceAiAccess(workspaceId);
    const token = process.env.CLOUDFLARE_AI_TOKEN;
    if (!token) {
      return { reply: '' };
    }

    try {
      // ────────────────────────────────────────────────────────────────
      // IMPORTANTE — EL FALLBACK CONTIENE `YOUR_ACCOUNT` (PLACEHOLDER).
      // SI NO ESTA SETEADO `CLOUDFLARE_AI_CHAT_URL` EN PROD, ESTA URL
      // FALLARA SILENCIOSAMENTE Y EL CHAT IA NO RESPONDERA.
      // EN PROD CONFIGURAR EN RAILWAY:
      //   `CLOUDFLARE_AI_CHAT_URL=https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/run/@cf/meta/llama-3-8b-instruct`
      // ────────────────────────────────────────────────────────────────
      const url = process.env.CLOUDFLARE_AI_CHAT_URL || 'https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT/ai/run/@cf/meta/llama-3-8b-instruct';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a business assistant. Reply with ONLY the requested output, no extra text or markdown.' },
            { role: 'user', content: body.input },
          ],
          max_tokens: 80,
        }),
      });

      if (!res.ok) return { reply: '' };
      const data: any = await res.json();
      const reply = data?.result?.response || data?.choices?.[0]?.message?.content || '';
      return { reply: reply.trim() };
    } catch {
      return { reply: '' };
    }
  }
}
