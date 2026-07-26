CREATE TABLE "PreDepartureSession" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "driverUserId" UUID NOT NULL,
    "transportJobId" UUID,
    "clientSessionId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "deviceId" UUID,
    "vehicleReference" VARCHAR(64),
    "trailerReference" VARCHAR(64),
    "contractVersion" VARCHAR(20) NOT NULL,
    "checklistVersion" VARCHAR(40) NOT NULL,
    "language" VARCHAR(2) NOT NULL,
    "contexts" JSONB NOT NULL,
    "state" VARCHAR(32) NOT NULL,
    "clientRevision" INTEGER NOT NULL,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "serverRevision" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PreDepartureSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreDepartureAnswer" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "checkId" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "note" VARCHAR(500),
    "notApplicableReason" VARCHAR(240),
    "answeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PreDepartureAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PreDepartureSession_companyId_clientSessionId_key"
ON "PreDepartureSession"("companyId", "clientSessionId");
CREATE UNIQUE INDEX "PreDepartureSession_companyId_idempotencyKey_key"
ON "PreDepartureSession"("companyId", "idempotencyKey");
CREATE INDEX "PreDepartureSession_companyId_state_updatedAt_idx"
ON "PreDepartureSession"("companyId", "state", "updatedAt");
CREATE INDEX "PreDepartureSession_transportJobId_updatedAt_idx"
ON "PreDepartureSession"("transportJobId", "updatedAt");
CREATE INDEX "PreDepartureSession_driverUserId_updatedAt_idx"
ON "PreDepartureSession"("driverUserId", "updatedAt");
CREATE UNIQUE INDEX "PreDepartureAnswer_sessionId_checkId_key"
ON "PreDepartureAnswer"("sessionId", "checkId");
CREATE INDEX "PreDepartureAnswer_companyId_status_idx"
ON "PreDepartureAnswer"("companyId", "status");

ALTER TABLE "PreDepartureSession"
ADD CONSTRAINT "PreDepartureSession_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PreDepartureSession"
ADD CONSTRAINT "PreDepartureSession_driverUserId_fkey"
FOREIGN KEY ("driverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PreDepartureSession"
ADD CONSTRAINT "PreDepartureSession_transportJobId_fkey"
FOREIGN KEY ("transportJobId") REFERENCES "TransportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreDepartureAnswer"
ADD CONSTRAINT "PreDepartureAnswer_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "PreDepartureSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
