import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AuthorityControlPlaneController } from './authority-control-plane.controller';
import { AuthorityControlPlaneService } from './authority-control-plane.service';
import { TurnAdminModule } from '../turn-admin/turn-admin.module';
import { SecretTelemetryModule } from '../secret-telemetry/secret-telemetry.module';

import { OperationalAgentDutyRunner } from './operational-agent-duty.runner';
@Module({
  imports: [DiscoveryModule, TurnAdminModule, SecretTelemetryModule],
  controllers: [AuthorityControlPlaneController],
  providers: [AuthorityControlPlaneService, OperationalAgentDutyRunner],
  exports: [AuthorityControlPlaneService],
})
export class AuthorityControlPlaneModule {}
