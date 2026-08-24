import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { EvidenceModule } from './evidence/evidence.module';
import { HealthController } from './health.controller';
import { IncidentsModule } from './incidents/incidents.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { PremiumLoadSafetyModule } from './premium-load-safety/premium-load-safety.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransportsModule } from './transports/transports.module';
import { TranslationModule } from './translation/translation.module';
import { UsersModule } from './users/users.module';
import { ValidationReportsModule } from './validation-reports/validation-reports.module';
import { TurnAdminModule } from './turn-admin/turn-admin.module';
import { validateEnvironment } from './config/environment';
import { PreDepartureSyncModule } from './pre-departure-sync/pre-departure-sync.module';
import { API_CORE_CONTRACT } from './api-core.contract';
import { SecretTelemetryModule } from './secret-telemetry/secret-telemetry.module';
import { ProductionPreflightModule } from './production-preflight/production-preflight.module';
import { OperationalEventStoreModule } from './operational-event-store/operational-event-store.module';
import { CommunicationModule } from './communications/communication.module';
import { PremiumAssistantModule } from './premium-assistant/premium-assistant.module';
import { DataRightsModule } from './data-rights/data-rights.module';
import { CarMoverModule } from './car-mover/car-mover.module';
import { AgentRuntimeEventsModule } from './agent-runtime-events/agent-runtime-events.module';
import { ComponentTelemetryModule } from './component-telemetry/component-telemetry.module';
import { AuthorityControlPlaneModule } from './authority-control-plane/authority-control-plane.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: API_CORE_CONTRACT.throttle.ttlMs,
      limit: API_CORE_CONTRACT.throttle.limit,
    }]),
    PrismaModule,
    UsersModule,
    AuthModule,
    AuditModule,
    EvidenceModule,
    IncidentsModule,
    ValidationReportsModule,
    LifecycleModule,
    PremiumLoadSafetyModule,
    TransportsModule,
    TranslationModule,
    TurnAdminModule,
    PreDepartureSyncModule,
    SecretTelemetryModule,
    ProductionPreflightModule,
    OperationalEventStoreModule,
    CommunicationModule,
    PremiumAssistantModule,
    DataRightsModule,
    CarMoverModule,
    AgentRuntimeEventsModule,
    ComponentTelemetryModule,
    AuthorityControlPlaneModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
