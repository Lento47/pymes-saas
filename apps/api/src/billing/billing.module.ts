import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaddleService } from './paddle.service';
import { BillingInvoiceService } from './billing-invoice.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [ConfigModule],
  controllers: [BillingController],
  providers: [PaddleService, BillingInvoiceService],
  exports: [PaddleService, BillingInvoiceService],
})
export class BillingModule {}
