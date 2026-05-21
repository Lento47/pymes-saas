import { Module } from "@nestjs/common";
import { ProductMetricsService } from "./product-metrics.service";
import { ProductMetricsController } from "./product-metrics.controller";

@Module({
  providers: [ProductMetricsService],
  controllers: [ProductMetricsController],
  exports: [ProductMetricsService],
})
export class ProductMetricsModule {}
