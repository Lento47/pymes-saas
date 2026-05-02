import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [NotificationsModule, FeatureFlagsModule],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
