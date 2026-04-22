import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TelemetryMiddleware } from './telemetry.middleware';

@Global()
@Module({})
export class TelemetryModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TelemetryMiddleware).forRoutes('*');
  }
}
