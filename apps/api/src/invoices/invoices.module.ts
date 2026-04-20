import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { RemindersService } from './reminders.service';

@Module({
  imports: [AiModule, ConversationsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, RemindersService],
})
export class InvoicesModule {}
