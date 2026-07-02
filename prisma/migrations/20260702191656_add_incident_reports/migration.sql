-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "transportJobId" UUID NOT NULL,
    "incidentType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reportedByUserId" UUID NOT NULL,
    "resolvedByUserId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentReport_companyId_status_idx" ON "IncidentReport"("companyId", "status");

-- CreateIndex
CREATE INDEX "IncidentReport_transportJobId_createdAt_idx" ON "IncidentReport"("transportJobId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentReport_companyId_severity_idx" ON "IncidentReport"("companyId", "severity");
