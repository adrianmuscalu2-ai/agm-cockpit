import { Module } from '@nestjs/common';
import { OpportunityIntelligenceModule } from '../opportunity-intelligence/opportunity-intelligence.module';
import { LiveAdapterController } from './live-adapter.controller';
import { LiveAdapterService } from './live-adapter.service';
import { LIVE_ADAPTERS } from './provider-adapters';

@Module({imports:[OpportunityIntelligenceModule],controllers:[LiveAdapterController],providers:[...LIVE_ADAPTERS,LiveAdapterService],exports:[LiveAdapterService]})
export class LiveAdapterModule{}
