import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],   // exportar para inyectar en otros servicios
})
export class EventsModule { }
