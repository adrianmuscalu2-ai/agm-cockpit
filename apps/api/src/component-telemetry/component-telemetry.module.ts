import { Module } from '@nestjs/common';
import { ComponentTelemetryController } from './component-telemetry.controller';
import { ComponentTelemetryService } from './component-telemetry.service';

@Module({
  controllers: [ComponentTelemetryController],
  providers: [ComponentTelemetryService],
  exports: [ComponentTelemetryService],
})
export class ComponentTelemetryModule {}
