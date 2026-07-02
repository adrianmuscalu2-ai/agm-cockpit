-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "defaultCurrencyCode" VARCHAR(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "personalDataStatus" TEXT NOT NULL DEFAULT 'Active',
    "anonymizedAt" TIMESTAMP(3),
    "retentionUntil" TIMESTAMP(3),
    "legalRetentionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedByUserId" UUID,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleState" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "countryCode" VARCHAR(2),
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprecatedAt" TIMESTAMP(3),

    CONSTRAINT "LifecycleState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportJob" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "transportNumber" TEXT NOT NULL,
    "currentLifecycleStateId" UUID NOT NULL,
    "pickupAddressSnapshot" JSONB,
    "deliveryAddressSnapshot" JSONB,
    "sourceConfidenceScore" DECIMAL(5,2),
    "plannedPickupFrom" TIMESTAMP(3),
    "plannedPickupTo" TIMESTAMP(3),
    "plannedDeliveryAt" TIMESTAMP(3),
    "paymentAmount" DECIMAL(12,2),
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "validationReportId" UUID,
    "auditEventId" UUID,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportJobStateHistory" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "transportJobId" UUID NOT NULL,
    "fromLifecycleStateId" UUID,
    "toLifecycleStateId" UUID NOT NULL,
    "businessAction" TEXT NOT NULL,
    "transitionReason" TEXT,
    "transitionedByUserId" UUID NOT NULL,
    "transitionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" UUID,
    "validationReportId" UUID,
    "relatedAIRecommendationId" UUID,
    "relatedAuditEventId" UUID NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "TransportJobStateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessValidationReport" (
    "id" UUID NOT NULL,
    "validationReportId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "validationType" TEXT NOT NULL,
    "validationVersion" TEXT NOT NULL,
    "parentValidationReportId" UUID,
    "correlationId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "overallResult" TEXT NOT NULL,
    "executedChecks" JSONB NOT NULL,
    "relatedBusinessAction" TEXT NOT NULL,
    "relatedEntityType" TEXT NOT NULL,
    "relatedEntityId" UUID NOT NULL,
    "transportJobId" UUID,
    "auditEventId" UUID,
    "stateHistoryId" UUID,
    "executionDurationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" UUID NOT NULL,

    CONSTRAINT "BusinessValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorUserId" UUID,
    "actorType" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "transportJobId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "evidenceMetadataId" UUID,
    "aiRecommendationId" UUID,
    "humanDecisionId" UUID,
    "validationReportId" UUID,
    "offlineSyncEventId" UUID,
    "ipAddress" TEXT,
    "deviceId" UUID,
    "requestId" UUID NOT NULL,
    "correlationId" UUID NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedger" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "transportJobId" UUID NOT NULL,
    "ledgerNumber" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "exchangeRateToBase" DECIMAL(12,6),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" UUID NOT NULL,
    "evidenceMetadataId" UUID,
    "reversesLedgerEntryId" UUID,
    "description" TEXT,
    "metadata" JSONB,
    "validationReportId" UUID,
    "auditEventId" UUID NOT NULL,

    CONSTRAINT "FinancialLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_code_key" ON "Role"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "LifecycleState_code_idx" ON "LifecycleState"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LifecycleState_companyId_code_key" ON "LifecycleState"("companyId", "code");

-- CreateIndex
CREATE INDEX "TransportJob_companyId_currentLifecycleStateId_idx" ON "TransportJob"("companyId", "currentLifecycleStateId");

-- CreateIndex
CREATE INDEX "TransportJob_createdAt_idx" ON "TransportJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransportJob_companyId_transportNumber_key" ON "TransportJob"("companyId", "transportNumber");

-- CreateIndex
CREATE INDEX "TransportJobStateHistory_transportJobId_transitionedAt_idx" ON "TransportJobStateHistory"("transportJobId", "transitionedAt");

-- CreateIndex
CREATE INDEX "TransportJobStateHistory_validationReportId_idx" ON "TransportJobStateHistory"("validationReportId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessValidationReport_validationReportId_key" ON "BusinessValidationReport"("validationReportId");

-- CreateIndex
CREATE INDEX "BusinessValidationReport_companyId_validationType_idx" ON "BusinessValidationReport"("companyId", "validationType");

-- CreateIndex
CREATE INDEX "BusinessValidationReport_correlationId_idx" ON "BusinessValidationReport"("correlationId");

-- CreateIndex
CREATE INDEX "BusinessValidationReport_transportJobId_idx" ON "BusinessValidationReport"("transportJobId");

-- CreateIndex
CREATE INDEX "AuditEvent_transportJobId_occurredAt_idx" ON "AuditEvent"("transportJobId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "AuditEvent_validationReportId_idx" ON "AuditEvent"("validationReportId");

-- CreateIndex
CREATE INDEX "FinancialLedger_transportJobId_occurredAt_idx" ON "FinancialLedger"("transportJobId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialLedger_companyId_ledgerNumber_idx" ON "FinancialLedger"("companyId", "ledgerNumber");

-- CreateIndex
CREATE INDEX "FinancialLedger_validationReportId_idx" ON "FinancialLedger"("validationReportId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleState" ADD CONSTRAINT "LifecycleState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportJob" ADD CONSTRAINT "TransportJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportJob" ADD CONSTRAINT "TransportJob_currentLifecycleStateId_fkey" FOREIGN KEY ("currentLifecycleStateId") REFERENCES "LifecycleState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportJobStateHistory" ADD CONSTRAINT "TransportJobStateHistory_transportJobId_fkey" FOREIGN KEY ("transportJobId") REFERENCES "TransportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportJobStateHistory" ADD CONSTRAINT "TransportJobStateHistory_fromLifecycleStateId_fkey" FOREIGN KEY ("fromLifecycleStateId") REFERENCES "LifecycleState"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportJobStateHistory" ADD CONSTRAINT "TransportJobStateHistory_toLifecycleStateId_fkey" FOREIGN KEY ("toLifecycleStateId") REFERENCES "LifecycleState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessValidationReport" ADD CONSTRAINT "BusinessValidationReport_transportJobId_fkey" FOREIGN KEY ("transportJobId") REFERENCES "TransportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_transportJobId_fkey" FOREIGN KEY ("transportJobId") REFERENCES "TransportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_transportJobId_fkey" FOREIGN KEY ("transportJobId") REFERENCES "TransportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
