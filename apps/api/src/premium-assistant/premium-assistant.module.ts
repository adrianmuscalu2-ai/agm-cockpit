import { Module } from '@nestjs/common';
import { PremiumAssistantController } from './premium-assistant.controller';
import { PremiumAssistantService } from './premium-assistant.service';
import { CanonicalAuthorityModule } from '../canonical-authority/canonical-authority.module';
import { PremiumAssistantKnowledgeService } from './premium-assistant-knowledge.service';
import { CommunicationModule } from '../communications/communication.module';
import { PremiumAssistantGmailService } from './premium-assistant-gmail.service';

@Module({ imports: [CanonicalAuthorityModule, CommunicationModule], controllers: [PremiumAssistantController], providers: [PremiumAssistantService, PremiumAssistantKnowledgeService, PremiumAssistantGmailService] })
export class PremiumAssistantModule {}

