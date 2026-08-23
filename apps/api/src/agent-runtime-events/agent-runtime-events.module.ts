import { Module } from '@nestjs/common';
import { AgentRuntimeEventsController } from './agent-runtime-events.controller';
import { AgentRuntimeEventsService } from './agent-runtime-events.service';

@Module({ controllers: [AgentRuntimeEventsController], providers: [AgentRuntimeEventsService], exports: [AgentRuntimeEventsService] })
export class AgentRuntimeEventsModule {}
