import { Module } from '@nestjs/common';
import { DashboardWarningAnalysisController } from './dashboard-warning-analysis.controller';
import { DashboardWarningAnalysisService } from './dashboard-warning-analysis.service';
@Module({ controllers: [DashboardWarningAnalysisController], providers: [DashboardWarningAnalysisService] })
export class DashboardWarningAnalysisModule {}
