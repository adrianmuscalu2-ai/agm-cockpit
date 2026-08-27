import { Global, Module } from '@nestjs/common';
import { PilotOperationsController } from './pilot-operations.controller';
import { PilotOperationsService } from './pilot-operations.service';

@Global()
@Module({controllers:[PilotOperationsController],providers:[PilotOperationsService],exports:[PilotOperationsService]})
export class PilotOperationsModule{}
