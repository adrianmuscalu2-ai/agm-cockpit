import { Module } from '@nestjs/common';
import { ValidationReportsService } from './validation-reports.service';

@Module({
  providers: [ValidationReportsService],
  exports: [ValidationReportsService],
})
export class ValidationReportsModule {}
