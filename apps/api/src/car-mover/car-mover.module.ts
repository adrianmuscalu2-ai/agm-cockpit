import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CarMoverController } from './car-mover.controller';
import { CarMoverRoutingController } from './car-mover-routing.controller';
import { CarMoverRoutingTelemetryService } from './car-mover-routing-telemetry.service';
import { CarMoverService } from './car-mover.service';

@Module({imports:[AuditModule],controllers:[CarMoverController,CarMoverRoutingController],providers:[CarMoverService,CarMoverRoutingTelemetryService],exports:[CarMoverService,CarMoverRoutingTelemetryService]})
export class CarMoverModule {}
