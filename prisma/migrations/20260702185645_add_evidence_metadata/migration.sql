-- CreateTable
CREATE TABLE "EvidenceMetadata" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "transportJobId" UUID,
    "evidenceType" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "checksumSha256" TEXT,
    "description" TEXT,
    "uploadedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "EvidenceMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceMetadata_companyId_transportJobId_idx" ON "EvidenceMetadata"("companyId", "transportJobId");

-- CreateIndex
CREATE INDEX "EvidenceMetadata_companyId_evidenceType_idx" ON "EvidenceMetadata"("companyId", "evidenceType");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceMetadata_companyId_storageProvider_storageKey_key" ON "EvidenceMetadata"("companyId", "storageProvider", "storageKey");
