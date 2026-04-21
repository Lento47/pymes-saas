import { Module } from '@nestjs/common';
import { ErrorReportsController } from './error-reports.controller';
import { ErrorReportsService } from './error-reports.service';

@Module({
  controllers: [ErrorReportsController],
  providers: [ErrorReportsService],
  exports: [ErrorReportsService],
})
export class ErrorReportsModule {}
