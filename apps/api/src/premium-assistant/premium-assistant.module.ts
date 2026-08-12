import { Module } from '@nestjs/common';
import { PremiumAssistantController } from './premium-assistant.controller';
import { PremiumAssistantService } from './premium-assistant.service';

@Module({ controllers: [PremiumAssistantController], providers: [PremiumAssistantService] })
export class PremiumAssistantModule {}

