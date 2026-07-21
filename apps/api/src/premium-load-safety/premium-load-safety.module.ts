import { Module } from '@nestjs/common';
import { PremiumLoadSafetyController } from './premium-load-safety.controller';
import { PremiumLoadSafetyProvider } from './premium-load-safety.provider';
import { SecuringRecommendationProvider } from './securing-recommendation/securing-recommendation.provider';
import { FieldTestProvider } from './field-test/field-test.provider';

@Module({
  controllers: [PremiumLoadSafetyController],
  providers: [PremiumLoadSafetyProvider, SecuringRecommendationProvider, FieldTestProvider],
})
export class PremiumLoadSafetyModule {}
