import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaddleService } from './paddle.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [ConfigModule],
  controllers: [BillingController],
  providers: [PaddleService],
  exports: [PaddleService],
})
export class BillingModule {}
