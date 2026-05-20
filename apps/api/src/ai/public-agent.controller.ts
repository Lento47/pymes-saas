import { Body, Controller, Post, Res, BadRequestException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AgentService } from './agent.service';

// ── Rate limit: 5 requests per 60s per IP for the public agent endpoint ──
// This prevents OpenAI API key abuse while allowing genuine landing-page
// visitors a reasonable experience (up to 5 questions/minute).

@Controller('agent')
export class PublicAgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('public')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async stream(@Body() body: { input: string }, @Res() res: Response) {
    // Input validation — prevent empty/injection payloads and limit length
    const input = body?.input;
    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      throw new BadRequestException('input es requerido y debe ser texto no vacío');
    }
    if (input.length > 500) {
      throw new BadRequestException('input máximo 500 caracteres');
    }

    const result = await this.agentService.streamPublic(input.trim());

    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const reader = result.stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      // Client disconnected
    } finally {
      reader.releaseLock();
      res.end();
    }
  }
}
