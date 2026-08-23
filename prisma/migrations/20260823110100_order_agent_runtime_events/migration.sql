ALTER TABLE "AgentRuntimeEvent" ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "AgentRuntimeEvent_companyId_mandateId_agentId_lifecycle_occurredAt_idx";
CREATE INDEX "AgentRuntimeEvent_companyId_mandateId_agentId_lifecycle_sequence_occurredAt_idx" ON "AgentRuntimeEvent"("companyId", "mandateId", "agentId", "lifecycle", "sequence", "occurredAt");
