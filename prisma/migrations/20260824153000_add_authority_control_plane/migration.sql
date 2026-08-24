CREATE TABLE "AuthorityScopePolicy" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "scopeId" VARCHAR(180) NOT NULL,
  "parentScopeId" VARCHAR(180), "ownerId" VARCHAR(160) NOT NULL, "resourceOwnership" JSONB NOT NULL,
  "allowedReadSet" JSONB NOT NULL, "allowedWriteSet" JSONB NOT NULL, "contractVersion" VARCHAR(40) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AuthorityScopePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorityMandate" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "mandateKey" VARCHAR(160) NOT NULL,
  "scopeId" VARCHAR(180) NOT NULL, "agentId" VARCHAR(160) NOT NULL, "mode" VARCHAR(24) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'APPROVED', "contractHash" VARCHAR(64) NOT NULL,
  "readSet" JSONB NOT NULL, "writeSet" JSONB NOT NULL, "resourceSelectors" JSONB NOT NULL,
  "prohibitedActions" JSONB NOT NULL, "approvedByUserId" UUID NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1, CONSTRAINT "AuthorityMandate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorityDecision" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "decisionKey" VARCHAR(160) NOT NULL, "mandateId" UUID NOT NULL,
  "proposalRef" VARCHAR(240), "actionType" VARCHAR(120) NOT NULL, "subjectType" VARCHAR(80), "subjectId" VARCHAR(180),
  "decision" JSONB NOT NULL, "status" VARCHAR(24) NOT NULL DEFAULT 'APPROVED', "decidedByUserId" UUID NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuthorityDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorityEpochState" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "currentEpoch" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AuthorityEpochState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorityLease" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "leaseKey" VARCHAR(180) NOT NULL, "requestId" VARCHAR(180) NOT NULL,
  "mandateId" UUID NOT NULL, "decisionId" UUID, "scopeId" VARCHAR(180) NOT NULL, "agentId" VARCHAR(160) NOT NULL,
  "providerId" VARCHAR(120) NOT NULL, "mode" VARCHAR(24) NOT NULL, "state" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  "epoch" INTEGER NOT NULL, "fencingToken" INTEGER NOT NULL, "readSet" JSONB NOT NULL, "writeSet" JSONB NOT NULL,
  "resourceSelectors" JSONB NOT NULL, "inheritedContractHash" VARCHAR(64) NOT NULL, "issuedByUserId" UUID NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1, CONSTRAINT "AuthorityLease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorityProviderBinding" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "scopeId" VARCHAR(180) NOT NULL, "agentId" VARCHAR(160) NOT NULL,
  "providerId" VARCHAR(120) NOT NULL, "priority" INTEGER NOT NULL DEFAULT 0, "mode" VARCHAR(24) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'ALLOWED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AuthorityProviderBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorityFailoverState" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "scopeId" VARCHAR(180) NOT NULL,
  "primaryProviderId" VARCHAR(120) NOT NULL, "activeProviderId" VARCHAR(120), "activeLeaseId" UUID,
  "state" VARCHAR(32) NOT NULL DEFAULT 'STANDBY', "epoch" INTEGER NOT NULL DEFAULT 0,
  "lastTransitionAt" TIMESTAMP(3), "transitionReason" VARCHAR(240), "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AuthorityFailoverState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorityAuditJournal" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "eventId" UUID NOT NULL, "eventType" VARCHAR(120) NOT NULL,
  "scopeId" VARCHAR(180), "mandateId" UUID, "decisionId" UUID, "leaseId" UUID,
  "actorType" VARCHAR(40) NOT NULL, "actorId" VARCHAR(160) NOT NULL, "outcome" VARCHAR(24) NOT NULL,
  "reasonCode" VARCHAR(80), "payloadHash" VARCHAR(64) NOT NULL, "safeMetadata" JSONB NOT NULL,
  "correlationId" UUID NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorityAuditJournal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PremiumNetworkRegistryEntry" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "canonicalId" VARCHAR(180) NOT NULL, "kind" VARCHAR(48) NOT NULL,
  "module" VARCHAR(80) NOT NULL, "ownerId" VARCHAR(160) NOT NULL, "supervisorId" VARCHAR(160), "scope" VARCHAR(180) NOT NULL,
  "readPermissions" JSONB NOT NULL, "writePermissions" JSONB NOT NULL, "prohibitedActions" JSONB NOT NULL,
  "capabilities" JSONB NOT NULL, "humanApprovalBoundary" VARCHAR(240) NOT NULL, "telemetryRequirement" VARCHAR(240) NOT NULL,
  "allowedProviders" JSONB NOT NULL, "fallbackProviders" JSONB NOT NULL, "recoveryPolicy" VARCHAR(240) NOT NULL,
  "lifecycleStatus" VARCHAR(32) NOT NULL DEFAULT 'REGISTERED', "contractVersion" VARCHAR(40) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PremiumNetworkRegistryEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecoveryRunbook" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "runbookKey" VARCHAR(160) NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "name" VARCHAR(180) NOT NULL, "allowedScopeId" VARCHAR(180) NOT NULL, "allowedActions" JSONB NOT NULL,
  "parameterSchema" JSONB NOT NULL, "preconditions" JSONB NOT NULL, "status" VARCHAR(24) NOT NULL DEFAULT 'APPROVED',
  "approvedByUserId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecoveryRunbook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecoveryExecution" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "executionKey" VARCHAR(180) NOT NULL, "runbookId" UUID NOT NULL,
  "mandateId" UUID NOT NULL, "decisionId" UUID NOT NULL, "authorityLeaseId" UUID NOT NULL, "scopeId" VARCHAR(180) NOT NULL,
  "fencingToken" INTEGER NOT NULL, "requestedActions" JSONB NOT NULL, "result" JSONB,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ADMITTED', "executedBy" VARCHAR(160) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "RecoveryExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthorityScopePolicy_companyId_scopeId_key" ON "AuthorityScopePolicy"("companyId", "scopeId");
CREATE INDEX "AuthorityScopePolicy_companyId_parentScopeId_status_idx" ON "AuthorityScopePolicy"("companyId", "parentScopeId", "status");
CREATE UNIQUE INDEX "AuthorityMandate_companyId_mandateKey_key" ON "AuthorityMandate"("companyId", "mandateKey");
CREATE INDEX "AuthorityMandate_companyId_scopeId_status_issuedAt_idx" ON "AuthorityMandate"("companyId", "scopeId", "status", "issuedAt");
CREATE INDEX "AuthorityMandate_companyId_agentId_status_idx" ON "AuthorityMandate"("companyId", "agentId", "status");
CREATE UNIQUE INDEX "AuthorityDecision_companyId_decisionKey_key" ON "AuthorityDecision"("companyId", "decisionKey");
CREATE INDEX "AuthorityDecision_companyId_mandateId_status_decidedAt_idx" ON "AuthorityDecision"("companyId", "mandateId", "status", "decidedAt");
CREATE UNIQUE INDEX "AuthorityEpochState_companyId_key" ON "AuthorityEpochState"("companyId");
CREATE UNIQUE INDEX "AuthorityLease_companyId_leaseKey_key" ON "AuthorityLease"("companyId", "leaseKey");
CREATE UNIQUE INDEX "AuthorityLease_companyId_requestId_key" ON "AuthorityLease"("companyId", "requestId");
CREATE UNIQUE INDEX "AuthorityLease_companyId_fencingToken_key" ON "AuthorityLease"("companyId", "fencingToken");
CREATE INDEX "AuthorityLease_companyId_scopeId_state_expiresAt_idx" ON "AuthorityLease"("companyId", "scopeId", "state", "expiresAt");
CREATE INDEX "AuthorityLease_companyId_agentId_state_idx" ON "AuthorityLease"("companyId", "agentId", "state");
CREATE UNIQUE INDEX "AuthorityProviderBinding_companyId_scopeId_agentId_providerId_key" ON "AuthorityProviderBinding"("companyId", "scopeId", "agentId", "providerId");
CREATE INDEX "AuthorityProviderBinding_companyId_scopeId_status_priority_idx" ON "AuthorityProviderBinding"("companyId", "scopeId", "status", "priority");
CREATE UNIQUE INDEX "AuthorityFailoverState_companyId_scopeId_key" ON "AuthorityFailoverState"("companyId", "scopeId");
CREATE INDEX "AuthorityFailoverState_companyId_state_updatedAt_idx" ON "AuthorityFailoverState"("companyId", "state", "updatedAt");
CREATE UNIQUE INDEX "AuthorityAuditJournal_companyId_eventId_key" ON "AuthorityAuditJournal"("companyId", "eventId");
CREATE INDEX "AuthorityAuditJournal_companyId_scopeId_occurredAt_idx" ON "AuthorityAuditJournal"("companyId", "scopeId", "occurredAt");
CREATE INDEX "AuthorityAuditJournal_companyId_leaseId_occurredAt_idx" ON "AuthorityAuditJournal"("companyId", "leaseId", "occurredAt");
CREATE UNIQUE INDEX "PremiumNetworkRegistryEntry_companyId_canonicalId_key" ON "PremiumNetworkRegistryEntry"("companyId", "canonicalId");
CREATE INDEX "PremiumNetworkRegistryEntry_companyId_module_lifecycleStatus_idx" ON "PremiumNetworkRegistryEntry"("companyId", "module", "lifecycleStatus");
CREATE INDEX "PremiumNetworkRegistryEntry_companyId_supervisorId_idx" ON "PremiumNetworkRegistryEntry"("companyId", "supervisorId");
CREATE UNIQUE INDEX "RecoveryRunbook_companyId_runbookKey_version_key" ON "RecoveryRunbook"("companyId", "runbookKey", "version");
CREATE INDEX "RecoveryRunbook_companyId_allowedScopeId_status_idx" ON "RecoveryRunbook"("companyId", "allowedScopeId", "status");
CREATE UNIQUE INDEX "RecoveryExecution_companyId_executionKey_key" ON "RecoveryExecution"("companyId", "executionKey");
CREATE INDEX "RecoveryExecution_companyId_scopeId_status_startedAt_idx" ON "RecoveryExecution"("companyId", "scopeId", "status", "startedAt");
CREATE INDEX "RecoveryExecution_companyId_authorityLeaseId_idx" ON "RecoveryExecution"("companyId", "authorityLeaseId");
