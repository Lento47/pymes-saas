import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AutomationsModule } from '../automations/automations.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [AutomationsModule, WorkersModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
