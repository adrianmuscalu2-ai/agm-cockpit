import { Module } from '@nestjs/common';
import { SecretTelemetryController } from './secret-telemetry.controller';
import { SecretTelemetryService } from './secret-telemetry.service';

@Module({ controllers: [SecretTelemetryController], providers: [SecretTelemetryService], exports: [SecretTelemetryService] })
export class SecretTelemetryModule {}
