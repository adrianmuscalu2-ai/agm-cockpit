CREATE TABLE "ComponentHeartbeat" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "componentId" VARCHAR(80) NOT NULL,
    "reportedStatus" VARCHAR(16) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastFailureReason" VARCHAR(240),
    "lastDetail" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentHeartbeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComponentHeartbeat_companyId_componentId_key"
ON "ComponentHeartbeat"("companyId", "componentId");

CREATE INDEX "ComponentHeartbeat_companyId_reportedStatus_lastSeenAt_idx"
ON "ComponentHeartbeat"("companyId", "reportedStatus", "lastSeenAt");

ALTER TABLE "ComponentHeartbeat"
ADD CONSTRAINT "ComponentHeartbeat_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
