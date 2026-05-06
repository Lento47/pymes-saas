import { Module, forwardRef } from '@nestjs/common';
import { ContactSalesService } from './contact-sales.service';
import { ContactSalesController } from './contact-sales.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [forwardRef(() => EmailModule)],
  providers: [ContactSalesService],
  controllers: [ContactSalesController],
  exports: [ContactSalesService],
})
export class ContactSalesModule {}
