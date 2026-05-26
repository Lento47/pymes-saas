import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { AutomationsModule } from "../automations/automations.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { LearningModule } from "../learning/learning.module";

@Module({
  imports: [AutomationsModule, NotificationsModule, LearningModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
