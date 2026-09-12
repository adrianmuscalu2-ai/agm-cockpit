import { Module } from '@nestjs/common';
import { PremiumAssistantController } from './premium-assistant.controller';
import { PremiumAssistantService } from './premium-assistant.service';
import { CanonicalAuthorityModule } from '../canonical-authority/canonical-authority.module';
import { PremiumAssistantKnowledgeService } from './premium-assistant-knowledge.service';

@Module({ imports: [CanonicalAuthorityModule], controllers: [PremiumAssistantController], providers: [PremiumAssistantService, PremiumAssistantKnowledgeService] })
export class PremiumAssistantModule {}

