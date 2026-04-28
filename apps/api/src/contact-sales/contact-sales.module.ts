import { Module } from '@nestjs/common';
import { ContactSalesService } from './contact-sales.service';
import { ContactSalesController } from './contact-sales.controller';

@Module({
  providers: [ContactSalesService],
  controllers: [ContactSalesController],
  exports: [ContactSalesService],
})
export class ContactSalesModule {}
