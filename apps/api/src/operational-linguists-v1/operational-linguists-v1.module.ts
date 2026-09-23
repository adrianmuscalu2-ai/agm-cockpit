import { Module } from '@nestjs/common';
import { MachineAuthModule } from '../machine-auth/machine-auth.module';
import { TurnAdminModule } from '../turn-admin/turn-admin.module';
import { OperationalLinguistsV1Controller } from './operational-linguists-v1.controller';
import { OperationalLinguistsV1Service } from './operational-linguists-v1.service';

@Module({
  imports: [MachineAuthModule, TurnAdminModule],
  controllers: [OperationalLinguistsV1Controller],
  providers: [OperationalLinguistsV1Service],
  exports: [OperationalLinguistsV1Service],
})
export class OperationalLinguistsV1Module {}
