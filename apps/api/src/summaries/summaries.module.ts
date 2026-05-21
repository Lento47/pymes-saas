import { Module } from '@nestjs/common';
import { SummariesService } from './summaries.service';
import { SummariesController } from './summaries.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [SummariesController],
  providers: [SummariesService],
  exports: [SummariesService],
})
export class SummariesModule {}
