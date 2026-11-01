CREATE TABLE "UniversalSessionLifecycleRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sessionId" VARCHAR(160) NOT NULL,
  "protocolVersion" VARCHAR(80) NOT NULL, "protocolRead" BOOLEAN NOT NULL,
  "archiveInterrogated" BOOLEAN NOT NULL, "librariansActivated" BOOLEAN NOT NULL,
  "currentBaseline" VARCHAR(160) NOT NULL, "canonicalSourcesLoaded" BOOLEAN NOT NULL,
  "actorMatrixLoaded" BOOLEAN NOT NULL, "worktreeRegistryLoaded" BOOLEAN NOT NULL,
  "activeIncidentsLoaded" BOOLEAN NOT NULL, "openMandatesLoaded" BOOLEAN NOT NULL,
  "riskKnowledgeAvailable" BOOLEAN NOT NULL, "sessionAuthorized" BOOLEAN NOT NULL,
  "actorId" VARCHAR(160) NOT NULL, "environmentClass" VARCHAR(64) NOT NULL,
  "correlationId" VARCHAR(160) NOT NULL, "evidenceRefs" JSONB NOT NULL,
  "finalStatus" VARCHAR(40) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invalidatedAt" TIMESTAMP(3), CONSTRAINT "UniversalSessionLifecycleRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UniversalSessionLifecycleRecord_sessionId_key" ON "UniversalSessionLifecycleRecord"("sessionId");
CREATE INDEX "UniversalSessionLifecycleRecord_environmentClass_finalStatus_idx" ON "UniversalSessionLifecycleRecord"("environmentClass", "finalStatus");
CREATE INDEX "UniversalSessionLifecycleRecord_correlationId_idx" ON "UniversalSessionLifecycleRecord"("correlationId");

CREATE TABLE "UniversalMandateLifecycleRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "mandateId" VARCHAR(160) NOT NULL,
  "sessionId" VARCHAR(160) NOT NULL, "mandateRegistered" BOOLEAN NOT NULL,
  "archiveSearchComplete" BOOLEAN NOT NULL, "librarianHandoffComplete" BOOLEAN NOT NULL,
  "precedentsLoaded" BOOLEAN NOT NULL, "canonicalSourcesVerified" BOOLEAN NOT NULL,
  "actorsVerified" BOOLEAN NOT NULL, "worktreeVerified" BOOLEAN NOT NULL,
  "dependencyReview" VARCHAR(40) NOT NULL, "riskPrecheck" VARCHAR(40) NOT NULL,
  "snapshotRef" VARCHAR(240) NOT NULL, "executionAuthorized" BOOLEAN NOT NULL,
  "actorRefs" JSONB NOT NULL, "correlationId" VARCHAR(160) NOT NULL,
  "evidenceRefs" JSONB NOT NULL, "status" VARCHAR(40) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "invalidatedAt" TIMESTAMP(3),
  CONSTRAINT "UniversalMandateLifecycleRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UniversalMandateLifecycleRecord_mandateId_key" ON "UniversalMandateLifecycleRecord"("mandateId");
CREATE INDEX "UniversalMandateLifecycleRecord_sessionId_status_idx" ON "UniversalMandateLifecycleRecord"("sessionId", "status");
CREATE INDEX "UniversalMandateLifecycleRecord_correlationId_idx" ON "UniversalMandateLifecycleRecord"("correlationId");

CREATE TABLE "UniversalMandateEndRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "mandateId" VARCHAR(160) NOT NULL,
  "technicalResult" VARCHAR(40) NOT NULL, "independentValidation" VARCHAR(40) NOT NULL,
  "riskPostReview" VARCHAR(40) NOT NULL, "finalVerdict" VARCHAR(40) NOT NULL,
  "incidentsUpdated" BOOLEAN NOT NULL, "versionUpdated" BOOLEAN NOT NULL,
  "cscPcrUpdated" BOOLEAN NOT NULL, "recoveryEvidenceRef" VARCHAR(240),
  "eventLedgerUpdated" BOOLEAN NOT NULL, "archiveUpdated" BOOLEAN NOT NULL,
  "lessonsLearned" TEXT, "nextAuthorizedAction" VARCHAR(240), "mandateClosed" BOOLEAN NOT NULL,
  "validatorId" VARCHAR(160) NOT NULL, "riskReviewerId" VARCHAR(160) NOT NULL,
  "closedAt" TIMESTAMP(3), "correlationId" VARCHAR(160) NOT NULL,
  "evidenceRefs" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UniversalMandateEndRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UniversalMandateEndRecord_mandateId_key" ON "UniversalMandateEndRecord"("mandateId");
CREATE INDEX "UniversalMandateEndRecord_finalVerdict_mandateClosed_idx" ON "UniversalMandateEndRecord"("finalVerdict", "mandateClosed");
CREATE INDEX "UniversalMandateEndRecord_correlationId_idx" ON "UniversalMandateEndRecord"("correlationId");

CREATE TABLE "UniversalSessionEndRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sessionId" VARCHAR(160) NOT NULL,
  "openMandates" JSONB NOT NULL, "blockers" JSONB NOT NULL, "currentCandidates" JSONB NOT NULL,
  "currentVersion" VARCHAR(80) NOT NULL, "dirtyWork" JSONB NOT NULL, "untrackedRelevantWork" JSONB NOT NULL,
  "worktrees" JSONB NOT NULL, "evidencePreserved" BOOLEAN NOT NULL, "latestCanonicalState" VARCHAR(80) NOT NULL,
  "nextAuthorizedAction" VARCHAR(240), "sessionClosed" BOOLEAN NOT NULL, "correlationId" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UniversalSessionEndRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UniversalSessionEndRecord_sessionId_key" ON "UniversalSessionEndRecord"("sessionId");
CREATE INDEX "UniversalSessionEndRecord_sessionClosed_idx" ON "UniversalSessionEndRecord"("sessionClosed");

CREATE TABLE "UniversalLifecycleEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "eventType" VARCHAR(80) NOT NULL,
  "sessionId" VARCHAR(160), "mandateId" VARCHAR(160), "actor" VARCHAR(160) NOT NULL,
  "correlationId" VARCHAR(160) NOT NULL, "previousEventId" UUID, "previousDigest" VARCHAR(64),
  "eventDigest" VARCHAR(64) NOT NULL, "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UniversalLifecycleEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UniversalLifecycleEvent_sessionId_occurredAt_idx" ON "UniversalLifecycleEvent"("sessionId", "occurredAt");
CREATE INDEX "UniversalLifecycleEvent_mandateId_occurredAt_idx" ON "UniversalLifecycleEvent"("mandateId", "occurredAt");
CREATE INDEX "UniversalLifecycleEvent_correlationId_idx" ON "UniversalLifecycleEvent"("correlationId");

CREATE TABLE "RiskKnowledgeAssessment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "mandateId" VARCHAR(160) NOT NULL,
  "phase" VARCHAR(32) NOT NULL, "verdict" VARCHAR(40) NOT NULL, "baselineRefs" JSONB NOT NULL,
  "predictedRisks" JSONB NOT NULL, "actualEffects" JSONB NOT NULL, "missedRisks" JSONB NOT NULL,
  "falsePositives" JSONB NOT NULL, "newPrecedents" JSONB NOT NULL, "candidateRef" VARCHAR(240) NOT NULL,
  "worktreeRef" VARCHAR(240) NOT NULL, "canonicalSourceRefs" JSONB NOT NULL, "writerAuthorityRefs" JSONB NOT NULL,
  "originalVerdict" VARCHAR(40) NOT NULL, "correlationId" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskKnowledgeAssessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskKnowledgeAssessment_mandateId_phase_idx" ON "RiskKnowledgeAssessment"("mandateId", "phase");
CREATE INDEX "RiskKnowledgeAssessment_verdict_createdAt_idx" ON "RiskKnowledgeAssessment"("verdict", "createdAt");

CREATE TABLE "RiskKnowledgeProtectionSet" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "mandateId" VARCHAR(160) NOT NULL,
  "items" JSONB NOT NULL, "createdBy" VARCHAR(160) NOT NULL, "correlationId" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskKnowledgeProtectionSet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RiskKnowledgeProtectionSet_mandateId_key" ON "RiskKnowledgeProtectionSet"("mandateId");

CREATE TABLE "RiskKnowledgeRecheck" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "mandateId" VARCHAR(160) NOT NULL,
  "trigger" VARCHAR(80) NOT NULL, "verdict" VARCHAR(40) NOT NULL, "stale" BOOLEAN NOT NULL,
  "evidenceRefs" JSONB NOT NULL, "correlationId" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskKnowledgeRecheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskKnowledgeRecheck_mandateId_createdAt_idx" ON "RiskKnowledgeRecheck"("mandateId", "createdAt");

CREATE TABLE "RiskKnowledgeComparison" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "mandateId" VARCHAR(160) NOT NULL,
  "capability" VARCHAR(180) NOT NULL, "beforeStatus" VARCHAR(40) NOT NULL, "afterStatus" VARCHAR(40) NOT NULL,
  "result" VARCHAR(40) NOT NULL, "priority" VARCHAR(4) NOT NULL, "evidenceRef" VARCHAR(240) NOT NULL,
  "explanation" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskKnowledgeComparison_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskKnowledgeComparison_mandateId_priority_afterStatus_idx" ON "RiskKnowledgeComparison"("mandateId", "priority", "afterStatus");

CREATE TABLE "RiskKnowledgeOverride" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "mandateId" VARCHAR(160) NOT NULL,
  "originalRiskVerdict" VARCHAR(40) NOT NULL, "actor" VARCHAR(160) NOT NULL, "reason" TEXT NOT NULL,
  "acceptedRisk" TEXT NOT NULL, "scope" VARCHAR(240) NOT NULL, "evidenceRef" VARCHAR(240) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "correlationId" VARCHAR(160) NOT NULL,
  CONSTRAINT "RiskKnowledgeOverride_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskKnowledgeOverride_mandateId_occurredAt_idx" ON "RiskKnowledgeOverride"("mandateId", "occurredAt");
