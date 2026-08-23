CREATE TABLE "AgentRuntimeEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "mandateId" VARCHAR(160) NOT NULL,
    "agentId" VARCHAR(120) NOT NULL,
    "dossierId" VARCHAR(160) NOT NULL,
    "lifecycle" VARCHAR(24) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceRef" TEXT NOT NULL,
    "outputRef" TEXT,
    "evidenceHash" VARCHAR(64),
    "detail" TEXT NOT NULL,
    CONSTRAINT "AgentRuntimeEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentRuntimeEvent_companyId_eventId_key" ON "AgentRuntimeEvent"("companyId", "eventId");
CREATE INDEX "AgentRuntimeEvent_companyId_mandateId_agentId_lifecycle_occurredAt_idx" ON "AgentRuntimeEvent"("companyId", "mandateId", "agentId", "lifecycle", "occurredAt");
CREATE INDEX "AgentRuntimeEvent_companyId_agentId_occurredAt_idx" ON "AgentRuntimeEvent"("companyId", "agentId", "occurredAt");
ALTER TABLE "AgentRuntimeEvent" ADD CONSTRAINT "AgentRuntimeEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
