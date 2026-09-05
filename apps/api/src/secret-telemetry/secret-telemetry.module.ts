import { Module } from '@nestjs/common';
import { TurnAdminModule } from '../turn-admin/turn-admin.module';
import { SecretTelemetryController } from './secret-telemetry.controller';
import { SecretTelemetryService } from './secret-telemetry.service';

@Module({ imports: [TurnAdminModule], controllers: [SecretTelemetryController], providers: [SecretTelemetryService], exports: [SecretTelemetryService] })
export class SecretTelemetryModule {}
