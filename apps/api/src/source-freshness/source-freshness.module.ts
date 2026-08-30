import { Module } from '@nestjs/common';
import { CanonicalAuthorityModule } from '../canonical-authority/canonical-authority.module';
import { CommunicationModule } from '../communications/communication.module';
import { SourceFreshnessController } from './source-freshness.controller';
import { MetadataOnlyFreshnessDetectionHook, SourceFreshnessDetectionHook } from './source-freshness.detector';
import { PrismaSourceFreshnessRepository, SourceFreshnessRepository } from './source-freshness.repository';
import { SourceFreshnessScanService } from './source-freshness.scan.service';
import { SourceFreshnessScheduler } from './source-freshness.scheduler';

@Module({
  imports: [CanonicalAuthorityModule, CommunicationModule],
  controllers: [SourceFreshnessController],
  providers: [
    SourceFreshnessScanService,
    SourceFreshnessScheduler,
    PrismaSourceFreshnessRepository,
    MetadataOnlyFreshnessDetectionHook,
    { provide: SourceFreshnessRepository, useExisting: PrismaSourceFreshnessRepository },
    { provide: SourceFreshnessDetectionHook, useExisting: MetadataOnlyFreshnessDetectionHook },
  ],
  exports: [SourceFreshnessScanService],
})
export class SourceFreshnessModule {}
