CREATE TABLE "DataRightsExternalRequest" (
  "id" UUID NOT NULL,
  "companyId" UUID,
  "subjectUserId" UUID,
  "contactHash" VARCHAR(64) NOT NULL,
  "requestType" VARCHAR(24) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'IDENTITY_PENDING',
  "verificationTokenHash" VARCHAR(64),
  "verificationExpiresAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "notificationStatus" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "DataRightsExternalRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataRightsExternalRequest_contactHash_createdAt_idx" ON "DataRightsExternalRequest"("contactHash", "createdAt");
CREATE INDEX "DataRightsExternalRequest_status_verificationExpiresAt_idx" ON "DataRightsExternalRequest"("status", "verificationExpiresAt");

CREATE TABLE "SubjectDataIndex" (
  "id" UUID NOT NULL,
  "companyId" UUID,
  "subjectId" UUID NOT NULL,
  "sourceTable" VARCHAR(100) NOT NULL,
  "sourceColumn" VARCHAR(100) NOT NULL,
  "recordId" VARCHAR(160) NOT NULL,
  "matchKind" VARCHAR(32) NOT NULL,
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locator" JSONB,
  CONSTRAINT "SubjectDataIndex_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubjectDataIndex_subjectId_sourceTable_sourceColumn_recordId_matchKind_key" ON "SubjectDataIndex"("subjectId", "sourceTable", "sourceColumn", "recordId", "matchKind");
CREATE INDEX "SubjectDataIndex_companyId_subjectId_sourceTable_idx" ON "SubjectDataIndex"("companyId", "subjectId", "sourceTable");
