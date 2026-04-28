import { Module } from '@nestjs/common';
import { PaddleWebhookController } from './paddle-webhook.controller';
import { PaddleService } from './paddle.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaddleWebhookController],
  providers: [PaddleService],
})
export class PaddleModule {}
