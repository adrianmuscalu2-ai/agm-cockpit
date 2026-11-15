import { Module } from '@nestjs/common';
import { AgentRuntimeEventsController } from './agent-runtime-events.controller';
import { AgentRuntimeEventsService } from './agent-runtime-events.service';
import { AcpmModule } from '../acpm/acpm.module';

@Module({ imports:[AcpmModule], controllers: [AgentRuntimeEventsController], providers: [AgentRuntimeEventsService], exports: [AgentRuntimeEventsService] })
export class AgentRuntimeEventsModule {}
