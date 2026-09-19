import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CarMoverController } from './car-mover.controller';
import { CarMoverRoutingController } from './car-mover-routing.controller';
import { CarMoverRoutingTelemetryService } from './car-mover-routing-telemetry.service';
import { CarMoverService } from './car-mover.service';
import { CommunicationModule } from '../communications/communication.module';
import { PermissionGuardianModule } from '../permission-guardian/permission-guardian.module';
import { TranslationModule } from '../translation/translation.module';
import { SharedArchiveModule } from '../shared-archive/shared-archive.module';
import { PremiumAssistantGmailService } from '../premium-assistant/premium-assistant-gmail.service';
import { CarMoverLibraryController } from './car-mover-library.controller';
import { CarMoverLibraryService } from './car-mover-library.service';
import { PrismaCarMoverLibraryRepository } from './car-mover-library.repository';

@Module({
  imports:[AuditModule,CommunicationModule,PermissionGuardianModule,TranslationModule,SharedArchiveModule],
  controllers:[CarMoverController,CarMoverRoutingController,CarMoverLibraryController],
  providers:[CarMoverService,CarMoverRoutingTelemetryService,PremiumAssistantGmailService,PrismaCarMoverLibraryRepository,CarMoverLibraryService],
  exports:[CarMoverService,CarMoverRoutingTelemetryService,CarMoverLibraryService],
})
export class CarMoverModule {}
