import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaypalWebhookController } from './paypal-webhook.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaypalWebhookController],
})
export class PaypalWebhookModule {}
