import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TurnOperationalTruthController } from './turn-operational-truth.controller';
import { TurnOperationalTruthInterceptor } from './turn-operational-truth.interceptor';
import { TurnOperationalTruthService } from './turn-operational-truth.service';

@Module({
  controllers: [TurnOperationalTruthController],
  providers: [
    TurnOperationalTruthService,
    { provide: APP_INTERCEPTOR, useClass: TurnOperationalTruthInterceptor },
  ],
  exports: [TurnOperationalTruthService],
})
export class TurnOperationalTruthModule {}
