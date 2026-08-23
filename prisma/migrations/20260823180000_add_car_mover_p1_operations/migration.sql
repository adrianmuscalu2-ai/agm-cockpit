CREATE TABLE "CarMoverFinancialEntry" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "jobId" UUID NOT NULL,
  "entryType" VARCHAR(24) NOT NULL,
  "category" VARCHAR(64) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "description" VARCHAR(500),
  "sourceReference" VARCHAR(240),
  "reversalOfId" UUID,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarMoverFinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarMoverInvoice" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "jobId" UUID NOT NULL,
  "direction" VARCHAR(16) NOT NULL,
  "invoiceNumber" VARCHAR(120) NOT NULL,
  "counterparty" VARCHAR(240) NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "amount" DECIMAL(14,2) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'RECORDED',
  "evidenceReference" VARCHAR(500),
  "externalAccountingReference" VARCHAR(240),
  "exportStatus" VARCHAR(32) NOT NULL DEFAULT 'NOT_EXPORTED',
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarMoverInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarMoverPlatformOffer" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "sourceMessageId" UUID NOT NULL,
  "channel" VARCHAR(16) NOT NULL,
  "platformName" VARCHAR(80) NOT NULL,
  "externalReference" VARCHAR(160),
  "pickupLabel" VARCHAR(240),
  "destinationLabel" VARCHAR(240),
  "pickupAt" TIMESTAMP(3),
  "vehicleDescription" VARCHAR(240),
  "offeredAmount" DECIMAL(14,2),
  "currencyCode" VARCHAR(3),
  "estimatedKm" INTEGER,
  "score" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(24) NOT NULL DEFAULT 'NEW',
  "version" INTEGER NOT NULL DEFAULT 0,
  "extractionConfidence" INTEGER NOT NULL DEFAULT 0,
  "analysis" JSONB NOT NULL,
  "rawMessageSha256" VARCHAR(64) NOT NULL,
  "linkedJobId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarMoverPlatformOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CarMoverFinancialEntry_companyId_jobId_occurredAt_idx" ON "CarMoverFinancialEntry"("companyId", "jobId", "occurredAt");
CREATE INDEX "CarMoverFinancialEntry_companyId_entryType_occurredAt_idx" ON "CarMoverFinancialEntry"("companyId", "entryType", "occurredAt");
CREATE INDEX "CarMoverFinancialEntry_companyId_reversalOfId_idx" ON "CarMoverFinancialEntry"("companyId", "reversalOfId");
CREATE UNIQUE INDEX "CarMoverInvoice_companyId_direction_invoiceNumber_key" ON "CarMoverInvoice"("companyId", "direction", "invoiceNumber");
CREATE INDEX "CarMoverInvoice_companyId_jobId_issueDate_idx" ON "CarMoverInvoice"("companyId", "jobId", "issueDate");
CREATE INDEX "CarMoverInvoice_companyId_status_dueDate_idx" ON "CarMoverInvoice"("companyId", "status", "dueDate");
CREATE UNIQUE INDEX "CarMoverPlatformOffer_companyId_sourceMessageId_key" ON "CarMoverPlatformOffer"("companyId", "sourceMessageId");
CREATE INDEX "CarMoverPlatformOffer_companyId_status_score_createdAt_idx" ON "CarMoverPlatformOffer"("companyId", "status", "score", "createdAt");
CREATE INDEX "CarMoverPlatformOffer_companyId_linkedJobId_idx" ON "CarMoverPlatformOffer"("companyId", "linkedJobId");

ALTER TABLE "CarMoverFinancialEntry" ADD CONSTRAINT "CarMoverFinancialEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarMoverFinancialEntry" ADD CONSTRAINT "CarMoverFinancialEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CarMoverJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarMoverInvoice" ADD CONSTRAINT "CarMoverInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarMoverInvoice" ADD CONSTRAINT "CarMoverInvoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CarMoverJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarMoverPlatformOffer" ADD CONSTRAINT "CarMoverPlatformOffer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarMoverPlatformOffer" ADD CONSTRAINT "CarMoverPlatformOffer_linkedJobId_fkey" FOREIGN KEY ("linkedJobId") REFERENCES "CarMoverJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
