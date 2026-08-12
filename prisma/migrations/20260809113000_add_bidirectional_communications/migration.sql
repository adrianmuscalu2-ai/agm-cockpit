CREATE TABLE "CommunicationConversation" (
  "id" UUID NOT NULL,"companyId" UUID NOT NULL,"channel" VARCHAR(16) NOT NULL,"provider" VARCHAR(32) NOT NULL,
  "externalThreadId" VARCHAR(240),"participantKey" VARCHAR(320) NOT NULL,"displayLabel" VARCHAR(160),"tripId" UUID,
  "status" VARCHAR(24) NOT NULL DEFAULT 'open',"lastMessageAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationConversation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CommunicationMessage" (
  "id" UUID NOT NULL,"companyId" UUID NOT NULL,"conversationId" UUID NOT NULL,"channel" VARCHAR(16) NOT NULL,"provider" VARCHAR(32) NOT NULL,
  "direction" VARCHAR(12) NOT NULL,"clientMessageId" UUID,"providerMessageId" VARCHAR(240),"providerEventId" VARCHAR(240),
  "fromAddress" VARCHAR(320) NOT NULL,"toAddress" VARCHAR(320) NOT NULL,"subject" VARCHAR(500),"bodyText" TEXT NOT NULL,"status" VARCHAR(24) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,"statusUpdatedAt" TIMESTAMP(3) NOT NULL,"retryCount" INTEGER NOT NULL DEFAULT 0,"lastErrorCode" VARCHAR(80),
  "metadata" JSONB,"createdByUserId" UUID,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunicationConversation_identity_key" ON "CommunicationConversation"("companyId","channel","provider","participantKey","externalThreadId");
CREATE INDEX "CommunicationConversation_companyId_channel_lastMessageAt_idx" ON "CommunicationConversation"("companyId","channel","lastMessageAt");
CREATE INDEX "CommunicationConversation_companyId_tripId_lastMessageAt_idx" ON "CommunicationConversation"("companyId","tripId","lastMessageAt");
CREATE UNIQUE INDEX "CommunicationMessage_companyId_clientMessageId_key" ON "CommunicationMessage"("companyId","clientMessageId");
CREATE UNIQUE INDEX "CommunicationMessage_provider_message_key" ON "CommunicationMessage"("companyId","channel","provider","providerMessageId");
CREATE UNIQUE INDEX "CommunicationMessage_provider_event_key" ON "CommunicationMessage"("companyId","channel","provider","providerEventId");
CREATE INDEX "CommunicationMessage_companyId_conversationId_occurredAt_idx" ON "CommunicationMessage"("companyId","conversationId","occurredAt");
CREATE INDEX "CommunicationMessage_companyId_status_statusUpdatedAt_idx" ON "CommunicationMessage"("companyId","status","statusUpdatedAt");
ALTER TABLE "CommunicationConversation" ADD CONSTRAINT "CommunicationConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CommunicationConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
