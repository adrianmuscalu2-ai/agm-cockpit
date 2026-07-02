import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { ValidationReportsModule } from '../validation-reports/validation-reports.module';
import { TransportsController } from './transports.controller';
import { TransportsService } from './transports.service';

@Module({
  imports: [AuditModule, LifecycleModule, ValidationReportsModule],
  controllers: [TransportsController],
  providers: [TransportsService],
})
export class TransportsModule {}
