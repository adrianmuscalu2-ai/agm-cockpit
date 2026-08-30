CREATE TABLE "SourceFreshnessRuntimeState" (
  "sourceId" VARCHAR(180) NOT NULL,
  "status" VARCHAR(48) NOT NULL,
  "reviewRequired" BOOLEAN NOT NULL,
  "lastEvaluatedAt" TIMESTAMP(3) NOT NULL,
  "lastObservation" JSONB NOT NULL,
  "candidateReview" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceFreshnessRuntimeState_pkey" PRIMARY KEY ("sourceId")
);
CREATE INDEX "SourceFreshnessRuntimeState_status_reviewRequired_idx" ON "SourceFreshnessRuntimeState"("status", "reviewRequired");

CREATE TABLE "SourceFreshnessAlertLedger" (
  "id" UUID NOT NULL,
  "dedupKey" VARCHAR(500) NOT NULL,
  "sourceId" VARCHAR(180) NOT NULL,
  "alertType" VARCHAR(48) NOT NULL,
  "status" VARCHAR(48) NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "SourceFreshnessAlertLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SourceFreshnessAlertLedger_dedupKey_sentAt_key" ON "SourceFreshnessAlertLedger"("dedupKey", "sentAt");
CREATE INDEX "SourceFreshnessAlertLedger_sourceId_sentAt_idx" ON "SourceFreshnessAlertLedger"("sourceId", "sentAt");

CREATE TABLE "SourceFreshnessReviewQueue" (
  "id" UUID NOT NULL,
  "reviewKey" VARCHAR(500) NOT NULL,
  "sourceId" VARCHAR(180) NOT NULL,
  "status" VARCHAR(48) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "candidate" JSONB,
  "reviewState" VARCHAR(48) NOT NULL DEFAULT 'PENDING_PRODUCT_OWNER_REVIEW',
  "firstDetectedAt" TIMESTAMP(3) NOT NULL,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceFreshnessReviewQueue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SourceFreshnessReviewQueue_reviewKey_key" ON "SourceFreshnessReviewQueue"("reviewKey");
CREATE INDEX "SourceFreshnessReviewQueue_reviewState_status_lastDetectedAt_idx" ON "SourceFreshnessReviewQueue"("reviewState", "status", "lastDetectedAt");
