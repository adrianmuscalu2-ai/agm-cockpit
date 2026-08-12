import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CarMoverController } from './car-mover.controller';
import { CarMoverService } from './car-mover.service';

@Module({imports:[AuditModule],controllers:[CarMoverController],providers:[CarMoverService],exports:[CarMoverService]})
export class CarMoverModule {}
