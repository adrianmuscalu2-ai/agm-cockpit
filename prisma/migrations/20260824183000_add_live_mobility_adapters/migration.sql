CREATE TABLE "LiveMobilitySnapshot" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "category" VARCHAR(40) NOT NULL,
  "contractType" VARCHAR(48) NOT NULL, "contractVersion" VARCHAR(48) NOT NULL,
  "entityReference" VARCHAR(240), "providerId" VARCHAR(120) NOT NULL,
  "sourceReference" VARCHAR(500) NOT NULL, "inputHash" VARCHAR(64) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL, "payload" JSONB NOT NULL, "fetchedAt" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3) NOT NULL, "stale" BOOLEAN NOT NULL DEFAULT false, "confidence" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveMobilitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveAdapterCache" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "category" VARCHAR(40) NOT NULL,
  "providerId" VARCHAR(120) NOT NULL, "cacheKey" VARCHAR(64) NOT NULL, "inputHash" VARCHAR(64) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL, "payload" JSONB NOT NULL, "sourceReference" VARCHAR(500) NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL, "validUntil" TIMESTAMP(3) NOT NULL, "requestCostMicros" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LiveAdapterCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveAdapterTelemetry" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "adapterId" VARCHAR(180) NOT NULL,
  "category" VARCHAR(40) NOT NULL, "providerId" VARCHAR(120) NOT NULL, "status" VARCHAR(24) NOT NULL,
  "lastAttemptAt" TIMESTAMP(3) NOT NULL, "lastSuccessAt" TIMESTAMP(3), "latencyMs" INTEGER,
  "requestCount" INTEGER NOT NULL DEFAULT 0, "errorCount" INTEGER NOT NULL DEFAULT 0,
  "errorRateBps" INTEGER NOT NULL DEFAULT 0, "rateLimitState" VARCHAR(24) NOT NULL DEFAULT 'CLEAR',
  "fallbackActivation" VARCHAR(120), "cacheAgeSeconds" INTEGER, "lastErrorCode" VARCHAR(80),
  "requestCostMicros" INTEGER, "contractVersion" VARCHAR(48) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveAdapterTelemetry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveMobilitySnapshot_companyId_category_entityReference_createdAt_idx" ON "LiveMobilitySnapshot"("companyId", "category", "entityReference", "createdAt");
CREATE INDEX "LiveMobilitySnapshot_companyId_inputHash_validUntil_idx" ON "LiveMobilitySnapshot"("companyId", "inputHash", "validUntil");
CREATE UNIQUE INDEX "LiveAdapterCache_companyId_category_cacheKey_key" ON "LiveAdapterCache"("companyId", "category", "cacheKey");
CREATE INDEX "LiveAdapterCache_companyId_category_validUntil_idx" ON "LiveAdapterCache"("companyId", "category", "validUntil");
CREATE UNIQUE INDEX "LiveAdapterTelemetry_companyId_adapterId_key" ON "LiveAdapterTelemetry"("companyId", "adapterId");
CREATE INDEX "LiveAdapterTelemetry_companyId_status_lastAttemptAt_idx" ON "LiveAdapterTelemetry"("companyId", "status", "lastAttemptAt");
