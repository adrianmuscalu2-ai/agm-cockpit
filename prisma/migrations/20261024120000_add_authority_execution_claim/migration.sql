CREATE TABLE "AuthorityExecutionClaim" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(240) NOT NULL,
  "mandateId" UUID NOT NULL,
  "leaseId" UUID NOT NULL,
  "executorId" VARCHAR(160) NOT NULL,
  "operation" VARCHAR(160) NOT NULL,
  "state" VARCHAR(24) NOT NULL DEFAULT 'CLAIMED',
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "result" JSONB,
  "failureReason" VARCHAR(240),
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthorityExecutionClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthorityExecutionClaim_companyId_idempotencyKey_key"
  ON "AuthorityExecutionClaim"("companyId", "idempotencyKey");
CREATE INDEX "AuthorityExecutionClaim_companyId_mandateId_leaseId_state_idx"
  ON "AuthorityExecutionClaim"("companyId", "mandateId", "leaseId", "state");
CREATE INDEX "AuthorityExecutionClaim_companyId_state_expiresAt_idx"
  ON "AuthorityExecutionClaim"("companyId", "state", "expiresAt");
