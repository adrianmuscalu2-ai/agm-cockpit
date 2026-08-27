CREATE TABLE "OpportunityIntakeRecord" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "idempotencyKey" VARCHAR(180) NOT NULL,
  "channel" VARCHAR(32) NOT NULL, "provider" VARCHAR(80) NOT NULL, "platformReference" VARCHAR(180),
  "sourceOpportunityId" VARCHAR(180), "sourceTimestamp" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "inputHash" VARCHAR(64) NOT NULL,
  "correlationKey" VARCHAR(64) NOT NULL, "freshnessStatus" VARCHAR(24) NOT NULL, "rawPayload" JSONB,
  "rawPayloadRetentionUntil" TIMESTAMP(3), "normalizedOpportunityId" UUID,
  "status" VARCHAR(24) NOT NULL DEFAULT 'INGESTED', CONSTRAINT "OpportunityIntakeRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NormalizedOpportunity" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "canonicalKey" VARCHAR(64) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "platform" VARCHAR(120) NOT NULL, "sourceOpportunityId" VARCHAR(180) NOT NULL,
  "pickupLocation" JSONB NOT NULL, "deliveryLocation" JSONB NOT NULL, "pickupWindowStart" TIMESTAMP(3),
  "pickupWindowEnd" TIMESTAMP(3), "deliveryWindowStart" TIMESTAMP(3), "deliveryWindowEnd" TIMESTAMP(3),
  "priceAmount" DECIMAL(14,2), "currencyCode" VARCHAR(3), "declaredKm" INTEGER, "vehicle" JSONB NOT NULL,
  "conditions" JSONB NOT NULL, "notes" TEXT, "sourceTimestamp" TIMESTAMP(3) NOT NULL,
  "freshnessStatus" VARCHAR(24) NOT NULL, "fieldConfidence" JSONB NOT NULL, "sourceReferences" JSONB NOT NULL,
  "inputHash" VARCHAR(64) NOT NULL, "status" VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NormalizedOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityRouteAssessment" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "routeAssessmentId" UUID NOT NULL,
  "assessmentKey" VARCHAR(180) NOT NULL, "version" INTEGER NOT NULL, "opportunityId" UUID NOT NULL,
  "previousOpportunityId" UUID, "providerId" VARCHAR(120) NOT NULL, "authorityLeaseId" UUID NOT NULL,
  "epoch" INTEGER NOT NULL, "fencingToken" INTEGER NOT NULL, "distanceKm" INTEGER NOT NULL,
  "durationMinutes" INTEGER NOT NULL, "distanceToPickupKm" INTEGER NOT NULL, "repositionKm" INTEGER NOT NULL,
  "repositionMinutes" INTEGER NOT NULL, "mobilityModes" JSONB NOT NULL, "tolls" JSONB NOT NULL,
  "restrictions" JSONB NOT NULL, "finalHomeDistanceKm" INTEGER, "feasible" BOOLEAN NOT NULL,
  "sources" JSONB NOT NULL, "assumptions" JSONB NOT NULL, "confidence" INTEGER NOT NULL,
  "calculation" JSONB NOT NULL, "warnings" JSONB NOT NULL, "inputHash" VARCHAR(64) NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "validUntil" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityRouteAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityCostAssessment" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "costAssessmentId" UUID NOT NULL,
  "assessmentKey" VARCHAR(180) NOT NULL, "version" INTEGER NOT NULL, "opportunityId" UUID NOT NULL,
  "routeAssessmentId" UUID NOT NULL, "providerId" VARCHAR(120) NOT NULL, "authorityLeaseId" UUID NOT NULL,
  "epoch" INTEGER NOT NULL, "fencingToken" INTEGER NOT NULL, "currencyCode" VARCHAR(3) NOT NULL,
  "estimatedRevenue" DECIMAL(14,2) NOT NULL, "estimatedFuel" DECIMAL(14,2) NOT NULL,
  "estimatedTrain" DECIMAL(14,2) NOT NULL, "estimatedBus" DECIMAL(14,2) NOT NULL,
  "estimatedTaxi" DECIMAL(14,2) NOT NULL, "estimatedTolls" DECIMAL(14,2) NOT NULL,
  "estimatedAccommodation" DECIMAL(14,2) NOT NULL, "estimatedOtherReposition" DECIMAL(14,2) NOT NULL,
  "estimatedTotalCost" DECIMAL(14,2) NOT NULL, "estimatedGrossProfit" DECIMAL(14,2) NOT NULL,
  "estimatedProfitPerKm" DECIMAL(14,4) NOT NULL, "estimatedProfitPerHour" DECIMAL(14,4) NOT NULL,
  "totalMinutes" INTEGER NOT NULL, "emptyKm" INTEGER NOT NULL, "financialRisk" VARCHAR(24) NOT NULL,
  "sensitivity" JSONB NOT NULL, "assumptions" JSONB NOT NULL, "inputHash" VARCHAR(64) NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "validUntil" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityCostAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityChain" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "chainKey" VARCHAR(180) NOT NULL,
  "version" INTEGER NOT NULL, "opportunityIds" JSONB NOT NULL, "routeAssessmentIds" JSONB NOT NULL,
  "costAssessmentIds" JSONB NOT NULL, "providerId" VARCHAR(120) NOT NULL, "authorityLeaseId" UUID NOT NULL,
  "epoch" INTEGER NOT NULL, "fencingToken" INTEGER NOT NULL, "objective" VARCHAR(80) NOT NULL,
  "metrics" JSONB NOT NULL, "feasible" BOOLEAN NOT NULL, "status" VARCHAR(24) NOT NULL DEFAULT 'PLAN',
  "inputHash" VARCHAR(64) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityChain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityVerdict" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "chainId" UUID NOT NULL, "version" INTEGER NOT NULL,
  "classification" VARCHAR(24) NOT NULL, "reasons" JSONB NOT NULL, "advantages" JSONB NOT NULL,
  "risks" JSONB NOT NULL, "confidence" INTEGER NOT NULL, "freshnessStatus" VARCHAR(24) NOT NULL,
  "assumptions" JSONB NOT NULL, "routeAssessmentRefs" JSONB NOT NULL, "costAssessmentRefs" JSONB NOT NULL,
  "contractVersion" VARCHAR(48) NOT NULL, "inputHash" VARCHAR(64) NOT NULL, "providerId" VARCHAR(120) NOT NULL,
  "authorityLeaseId" UUID NOT NULL, "epoch" INTEGER NOT NULL, "fencingToken" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OpportunityVerdict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityHumanDecision" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "decisionKey" VARCHAR(180) NOT NULL, "verdictId" UUID NOT NULL,
  "decision" VARCHAR(16) NOT NULL, "decidedByUserId" UUID NOT NULL, "reason" VARCHAR(500),
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OpportunityHumanDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityJobLink" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "humanDecisionId" UUID NOT NULL,
  "verdictId" UUID NOT NULL, "normalizedOpportunityId" UUID NOT NULL, "jobId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OpportunityJobLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityAgentTelemetry" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "agentId" VARCHAR(180) NOT NULL, "health" VARCHAR(24) NOT NULL,
  "lastRunAt" TIMESTAMP(3) NOT NULL, "durationMs" INTEGER NOT NULL, "freshnessStatus" VARCHAR(24) NOT NULL,
  "backlog" INTEGER NOT NULL DEFAULT 0, "dependencyHealth" VARCHAR(24) NOT NULL, "confidence" INTEGER,
  "inputReference" VARCHAR(240), "outputReference" VARCHAR(240), "providerId" VARCHAR(120) NOT NULL,
  "contractVersion" VARCHAR(48) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityAgentTelemetry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityAnalysisRun" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "idempotencyKey" VARCHAR(180) NOT NULL,
  "inputHash" VARCHAR(64) NOT NULL, "chainIds" JSONB NOT NULL, "verdictIds" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OpportunityAnalysisRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpportunityIntakeRecord_companyId_correlationKey_receivedAt_idx" ON "OpportunityIntakeRecord"("companyId", "correlationKey", "receivedAt");
CREATE INDEX "OpportunityIntakeRecord_companyId_inputHash_idx" ON "OpportunityIntakeRecord"("companyId", "inputHash");
CREATE UNIQUE INDEX "OpportunityIntakeRecord_companyId_idempotencyKey_key" ON "OpportunityIntakeRecord"("companyId", "idempotencyKey");
CREATE INDEX "NormalizedOpportunity_companyId_status_freshnessStatus_createdAt_idx" ON "NormalizedOpportunity"("companyId", "status", "freshnessStatus", "createdAt");
CREATE UNIQUE INDEX "NormalizedOpportunity_companyId_canonicalKey_version_key" ON "NormalizedOpportunity"("companyId", "canonicalKey", "version");
CREATE INDEX "OpportunityRouteAssessment_companyId_opportunityId_calculatedAt_idx" ON "OpportunityRouteAssessment"("companyId", "opportunityId", "calculatedAt");
CREATE UNIQUE INDEX "OpportunityRouteAssessment_companyId_routeAssessmentId_key" ON "OpportunityRouteAssessment"("companyId", "routeAssessmentId");
CREATE UNIQUE INDEX "OpportunityRouteAssessment_companyId_assessmentKey_version_key" ON "OpportunityRouteAssessment"("companyId", "assessmentKey", "version");
CREATE INDEX "OpportunityCostAssessment_companyId_opportunityId_calculatedAt_idx" ON "OpportunityCostAssessment"("companyId", "opportunityId", "calculatedAt");
CREATE UNIQUE INDEX "OpportunityCostAssessment_companyId_costAssessmentId_key" ON "OpportunityCostAssessment"("companyId", "costAssessmentId");
CREATE UNIQUE INDEX "OpportunityCostAssessment_companyId_assessmentKey_version_key" ON "OpportunityCostAssessment"("companyId", "assessmentKey", "version");
CREATE INDEX "OpportunityChain_companyId_status_createdAt_idx" ON "OpportunityChain"("companyId", "status", "createdAt");
CREATE UNIQUE INDEX "OpportunityChain_companyId_chainKey_version_key" ON "OpportunityChain"("companyId", "chainKey", "version");
CREATE INDEX "OpportunityVerdict_companyId_classification_createdAt_idx" ON "OpportunityVerdict"("companyId", "classification", "createdAt");
CREATE UNIQUE INDEX "OpportunityVerdict_companyId_chainId_version_key" ON "OpportunityVerdict"("companyId", "chainId", "version");
CREATE INDEX "OpportunityHumanDecision_companyId_verdictId_decidedAt_idx" ON "OpportunityHumanDecision"("companyId", "verdictId", "decidedAt");
CREATE UNIQUE INDEX "OpportunityHumanDecision_companyId_decisionKey_key" ON "OpportunityHumanDecision"("companyId", "decisionKey");
CREATE INDEX "OpportunityJobLink_companyId_humanDecisionId_idx" ON "OpportunityJobLink"("companyId", "humanDecisionId");
CREATE UNIQUE INDEX "OpportunityJobLink_companyId_normalizedOpportunityId_verdictId_key" ON "OpportunityJobLink"("companyId", "normalizedOpportunityId", "verdictId");
CREATE UNIQUE INDEX "OpportunityJobLink_companyId_jobId_key" ON "OpportunityJobLink"("companyId", "jobId");
CREATE INDEX "OpportunityAgentTelemetry_companyId_health_lastRunAt_idx" ON "OpportunityAgentTelemetry"("companyId", "health", "lastRunAt");
CREATE UNIQUE INDEX "OpportunityAgentTelemetry_companyId_agentId_key" ON "OpportunityAgentTelemetry"("companyId", "agentId");
CREATE INDEX "OpportunityAnalysisRun_companyId_createdAt_idx" ON "OpportunityAnalysisRun"("companyId", "createdAt");
CREATE UNIQUE INDEX "OpportunityAnalysisRun_companyId_idempotencyKey_key" ON "OpportunityAnalysisRun"("companyId", "idempotencyKey");
