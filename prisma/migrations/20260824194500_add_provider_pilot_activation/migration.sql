CREATE TABLE "ProviderPilotActivation" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "providerId" VARCHAR(120) NOT NULL,
  "state" VARCHAR(24) NOT NULL DEFAULT 'READY',
  "credentialReference" VARCHAR(240),
  "allowedUserId" UUID,
  "pilotStartAt" TIMESTAMP(3) NOT NULL,
  "pilotEndAt" TIMESTAMP(3) NOT NULL,
  "dailyRequestLimit" INTEGER NOT NULL,
  "anomalyAlertPercent" INTEGER NOT NULL DEFAULT 80,
  "dailyCostAlertMicros" INTEGER,
  "estimatedUnitCostMicros" INTEGER,
  "costBasis" VARCHAR(80) NOT NULL DEFAULT 'PROVIDER_BILLING_UNAVAILABLE',
  "suspendedReason" VARCHAR(240),
  "updatedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderPilotActivation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderPilotActivation_companyId_providerId_key" ON "ProviderPilotActivation"("companyId", "providerId");
CREATE INDEX "ProviderPilotActivation_companyId_state_pilotEndAt_idx" ON "ProviderPilotActivation"("companyId", "state", "pilotEndAt");

CREATE TABLE "ProviderUsageEvent" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID,
  "providerId" VARCHAR(120) NOT NULL,
  "adapterId" VARCHAR(180) NOT NULL,
  "category" VARCHAR(40) NOT NULL,
  "eventType" VARCHAR(40) NOT NULL,
  "inputHash" VARCHAR(64),
  "outcome" VARCHAR(32) NOT NULL,
  "latencyMs" INTEGER,
  "cacheHit" BOOLEAN NOT NULL DEFAULT false,
  "coalesced" BOOLEAN NOT NULL DEFAULT false,
  "recalculation" BOOLEAN NOT NULL DEFAULT false,
  "fallbackActivation" BOOLEAN NOT NULL DEFAULT false,
  "rateLimited" BOOLEAN NOT NULL DEFAULT false,
  "timeout" BOOLEAN NOT NULL DEFAULT false,
  "stale" BOOLEAN NOT NULL DEFAULT false,
  "errorCode" VARCHAR(80),
  "estimatedCostMicros" INTEGER,
  "actualCostMicros" INTEGER,
  "metrics" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderUsageEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProviderUsageEvent_companyId_providerId_occurredAt_idx" ON "ProviderUsageEvent"("companyId", "providerId", "occurredAt");
CREATE INDEX "ProviderUsageEvent_companyId_adapterId_occurredAt_idx" ON "ProviderUsageEvent"("companyId", "adapterId", "occurredAt");
CREATE INDEX "ProviderUsageEvent_companyId_inputHash_occurredAt_idx" ON "ProviderUsageEvent"("companyId", "inputHash", "occurredAt");

CREATE TABLE "GmailPilotTelemetry" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "state" VARCHAR(24) NOT NULL DEFAULT 'NO_TELEMETRY',
  "syncCount" INTEGER NOT NULL DEFAULT 0,
  "messagesProcessed" INTEGER NOT NULL DEFAULT 0,
  "relevantMessages" INTEGER NOT NULL DEFAULT 0,
  "opportunitiesExtracted" INTEGER NOT NULL DEFAULT 0,
  "duplicatesEliminated" INTEGER NOT NULL DEFAULT 0,
  "parsingErrors" INTEGER NOT NULL DEFAULT 0,
  "staleMessages" INTEGER NOT NULL DEFAULT 0,
  "totalLatencyMs" INTEGER NOT NULL DEFAULT 0,
  "backlog" INTEGER NOT NULL DEFAULT 0,
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastAnalysisAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(80),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GmailPilotTelemetry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GmailPilotTelemetry_companyId_key" ON "GmailPilotTelemetry"("companyId");
