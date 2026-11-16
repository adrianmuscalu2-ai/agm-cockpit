import { LunaAcpmLedger } from './luna-acpm-ledger';
import { LunaProductionAccessGuard } from './luna-production-access.guard';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRuntimeEventsModule } from '../agent-runtime-events/agent-runtime-events.module';
import { OperationalEventStoreModule } from '../operational-event-store/operational-event-store.module';
import { OperationalEventAccessGuard } from '../operational-event-store/operational-event-access';
import { PrismaModule } from '../prisma/prisma.module';
import { TurnAdminModule } from '../turn-admin/turn-admin.module';
import { AgmatccCopilotController } from './agmatcc-copilot.controller';
import { AGMATCC_COPILOT_PROVIDER, AgmatccCopilotService } from './agmatcc-copilot.service';
import { DisabledAgmatccProvider, OpenAIResponsesAgmatccProvider, SimulatedAgmatccProvider } from './agmatcc-copilot.provider';

@Module({
  imports: [AgentRuntimeEventsModule, OperationalEventStoreModule, PrismaModule, TurnAdminModule],
  controllers: [AgmatccCopilotController],
  providers: [
    AgmatccCopilotService,
    LunaAcpmLedger,
    OperationalEventAccessGuard,
    LunaProductionAccessGuard,
    {
      provide: AGMATCC_COPILOT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode = config.get<string>('AGMATCC_COPILOT_PROVIDER', 'simulated');
        if (mode === 'simulated') return config.get<string>('NODE_ENV') === 'production'
          ? new DisabledAgmatccProvider() : new SimulatedAgmatccProvider();
        const enabled = config.get<string>('NODE_ENV') === 'production' ? config.get<string>('AGMATCC_LUNA_PRODUCTION_ENABLED') === 'true' : config.get<string>('AGMATCC_COPILOT_ISOLATED_ENABLED') === 'true';
        if (mode !== 'openai' || !enabled) {
          throw new Error('ACPM_OPENAI_PROVIDER_LOCAL_ISOLATION_REQUIRED');
        }
        const apiKey = config.get<string>('OPENAI_API_KEY');
        if (!apiKey || apiKey === 'LOCAL_ISOLATED_NO_KEY_CONFIG_SENTINEL') throw new Error('ACPM_OPENAI_KEY_REQUIRED');
        return new OpenAIResponsesAgmatccProvider(apiKey);
      },
    },
  ],
})
export class AgmatccCopilotModule {}
