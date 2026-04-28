import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { HaciendaModule } from '../hacienda/hacienda.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { RemindersService } from './reminders.service';

@Module({
  imports: [AiModule, ConversationsModule, HaciendaModule, NotificationsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, RemindersService],
})
export class InvoicesModule {}
