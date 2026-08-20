CREATE TABLE "DataSubjectRequest" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "requestedByUserId" UUID NOT NULL,
  "requestType" VARCHAR(24) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "refusalReason" VARCHAR(240),
  "exportSchemaVersion" VARCHAR(40),
  "exportSha256" VARCHAR(64),
  "metadata" JSONB,
  CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataSubjectRequest_companyId_requestedByUserId_requestedAt_idx" ON "DataSubjectRequest"("companyId", "requestedByUserId", "requestedAt");
CREATE INDEX "DataSubjectRequest_status_requestedAt_idx" ON "DataSubjectRequest"("status", "requestedAt");
