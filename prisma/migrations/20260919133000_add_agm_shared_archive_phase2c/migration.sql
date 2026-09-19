CREATE TABLE "AgmSharedArchiveRecord" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "namespace" VARCHAR(120) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "payload" JSONB,
    "searchText" TEXT NOT NULL,
    "syncPolicy" VARCHAR(24) NOT NULL,
    "persistence" VARCHAR(40) NOT NULL,
    "sourceSurface" VARCHAR(16) NOT NULL,
    "userApprovedAt" TIMESTAMP(3) NOT NULL,
    "approvalEvidence" VARCHAR(240) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" VARCHAR(240),
    "deletedAt" TIMESTAMP(3),
    "contractVersion" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgmSharedArchiveRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgmSharedArchiveRecord_companyId_ownerUserId_category_observedAt_idx"
ON "AgmSharedArchiveRecord"("companyId", "ownerUserId", "category", "observedAt");

CREATE INDEX "AgmSharedArchiveRecord_companyId_ownerUserId_revokedAt_deletedAt_idx"
ON "AgmSharedArchiveRecord"("companyId", "ownerUserId", "revokedAt", "deletedAt");

CREATE INDEX "AgmSharedArchiveRecord_namespace_observedAt_idx"
ON "AgmSharedArchiveRecord"("namespace", "observedAt");

ALTER TABLE "AgmSharedArchiveRecord"
ADD CONSTRAINT "AgmSharedArchiveRecord_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgmSharedArchiveRecord"
ADD CONSTRAINT "AgmSharedArchiveRecord_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
