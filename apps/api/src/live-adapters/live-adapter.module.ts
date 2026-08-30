import { Module } from '@nestjs/common';
import { OpportunityIntelligenceModule } from '../opportunity-intelligence/opportunity-intelligence.module';
import { CanonicalAuthorityModule } from '../canonical-authority/canonical-authority.module';
import { LiveAdapterController } from './live-adapter.controller';
import { LiveAdapterService } from './live-adapter.service';
import { LIVE_ADAPTERS } from './provider-adapters';

@Module({imports:[OpportunityIntelligenceModule,CanonicalAuthorityModule],controllers:[LiveAdapterController],providers:[...LIVE_ADAPTERS,LiveAdapterService],exports:[LiveAdapterService]})
export class LiveAdapterModule{}
