import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AgentService } from './agent.service';

@Controller('agent')
export class PublicAgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('public')
  async stream(@Body() body: { input: string }, @Res() res: Response) {
    const result = await this.agentService.streamPublic(body.input);

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
