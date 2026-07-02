import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health.controller';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransportsModule } from './transports/transports.module';
import { UsersModule } from './users/users.module';
import { ValidationReportsModule } from './validation-reports/validation-reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    AuditModule,
    ValidationReportsModule,
    LifecycleModule,
    TransportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
