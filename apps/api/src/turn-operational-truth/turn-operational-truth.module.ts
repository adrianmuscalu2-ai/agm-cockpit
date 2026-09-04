import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TranslationModule } from '../translation/translation.module';
import { TurnAdminModule } from '../turn-admin/turn-admin.module';
import { TurnFunctionalOverviewService } from './turn-functional-overview.service';
import { TurnOperationalTruthController } from './turn-operational-truth.controller';
import { TurnOperationalTruthInterceptor } from './turn-operational-truth.interceptor';
import { TurnOperationalTruthService } from './turn-operational-truth.service';

@Module({
  imports: [TurnAdminModule, TranslationModule],
  controllers: [TurnOperationalTruthController],
  providers: [
    TurnFunctionalOverviewService,
    TurnOperationalTruthService,
    { provide: APP_INTERCEPTOR, useClass: TurnOperationalTruthInterceptor },
  ],
  exports: [TurnOperationalTruthService],
})
export class TurnOperationalTruthModule {}
