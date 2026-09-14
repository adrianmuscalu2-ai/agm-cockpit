import { Module } from '@nestjs/common';
import { PermissionGuardianController } from './permission-guardian.controller';
import { PermissionGuardianService } from './permission-guardian.service';

@Module({ controllers: [PermissionGuardianController], providers: [PermissionGuardianService], exports: [PermissionGuardianService] })
export class PermissionGuardianModule {}
