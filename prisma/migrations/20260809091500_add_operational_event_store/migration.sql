CREATE TABLE "OperationalEventStream" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "streamId" UUID NOT NULL,
  "aggregateType" VARCHAR(64) NOT NULL,
  "currentVersion" INTEGER NOT NULL DEFAULT -1,
  "projection" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalEventStream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalEvent" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "streamRecordId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "schemaVersion" VARCHAR(40) NOT NULL,
  "eventType" VARCHAR(120) NOT NULL,
  "eventVersion" INTEGER NOT NULL,
  "aggregateVersion" INTEGER NOT NULL,
  "deviceId" UUID NOT NULL,
  "deviceSequence" INTEGER NOT NULL,
  "operationId" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "envelope" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalEventStream_companyId_streamId_key" ON "OperationalEventStream"("companyId", "streamId");
CREATE INDEX "OperationalEventStream_companyId_updatedAt_idx" ON "OperationalEventStream"("companyId", "updatedAt");
CREATE UNIQUE INDEX "OperationalEvent_companyId_eventId_key" ON "OperationalEvent"("companyId", "eventId");
CREATE UNIQUE INDEX "OperationalEvent_companyId_idempotencyKey_key" ON "OperationalEvent"("companyId", "idempotencyKey");
CREATE UNIQUE INDEX "OperationalEvent_streamRecordId_aggregateVersion_key" ON "OperationalEvent"("streamRecordId", "aggregateVersion");
CREATE UNIQUE INDEX "OperationalEvent_streamRecordId_deviceId_deviceSequence_key" ON "OperationalEvent"("streamRecordId", "deviceId", "deviceSequence");
CREATE INDEX "OperationalEvent_companyId_streamRecordId_aggregateVersion_idx" ON "OperationalEvent"("companyId", "streamRecordId", "aggregateVersion");
CREATE INDEX "OperationalEvent_companyId_occurredAt_idx" ON "OperationalEvent"("companyId", "occurredAt");
ALTER TABLE "OperationalEventStream" ADD CONSTRAINT "OperationalEventStream_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalEvent" ADD CONSTRAINT "OperationalEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalEvent" ADD CONSTRAINT "OperationalEvent_streamRecordId_fkey" FOREIGN KEY ("streamRecordId") REFERENCES "OperationalEventStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
