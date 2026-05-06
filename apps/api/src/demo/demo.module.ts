import { Module } from '@nestjs/common';
import { DemoDataService } from './demo-data.service';

@Module({
  providers: [DemoDataService],
  exports: [DemoDataService],
})
export class DemoModule {}
