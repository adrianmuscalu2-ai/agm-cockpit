import { Module } from '@nestjs/common';
import { SecretTelemetryModule } from '../secret-telemetry/secret-telemetry.module';
import { TurnAdminModule } from '../turn-admin/turn-admin.module';
import { ProductionPreflightController } from './production-preflight.controller';
import { ProductionPreflightService } from './production-preflight.service';

@Module({
  imports: [TurnAdminModule, SecretTelemetryModule],
  controllers: [ProductionPreflightController],
  providers: [ProductionPreflightService],
})
export class ProductionPreflightModule {}
