import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { EvidenceModule } from './evidence/evidence.module';
import { HealthController } from './health.controller';
import { IncidentsModule } from './incidents/incidents.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransportsModule } from './transports/transports.module';
import { TranslationModule } from './translation/translation.module';
import { UsersModule } from './users/users.module';
import { ValidationReportsModule } from './validation-reports/validation-reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    AuditModule,
    EvidenceModule,
    IncidentsModule,
    ValidationReportsModule,
    LifecycleModule,
    TransportsModule,
    TranslationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
