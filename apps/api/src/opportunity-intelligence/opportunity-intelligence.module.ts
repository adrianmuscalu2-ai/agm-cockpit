import { AcpmModule } from '../acpm/acpm.module';
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthorityControlPlaneModule } from '../authority-control-plane/authority-control-plane.module';
import { CarMoverModule } from '../car-mover/car-mover.module';
import { OpportunityIntelligenceController } from './opportunity-intelligence.controller';
import { OpportunityIntelligenceService } from './opportunity-intelligence.service';
import { OpportunityTelemetryInterceptor } from './opportunity-telemetry.interceptor';

@Module({
  imports: [AcpmModule, AuditModule, AuthorityControlPlaneModule, CarMoverModule],
  controllers: [OpportunityIntelligenceController],
  providers: [OpportunityIntelligenceService, OpportunityTelemetryInterceptor],
  exports: [OpportunityIntelligenceService],
})
export class OpportunityIntelligenceModule {}
