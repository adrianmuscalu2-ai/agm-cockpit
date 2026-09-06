CREATE TABLE "TurnAdminSession" (
  "id" UUID NOT NULL,
  "familyId" UUID NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 0,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedAt" TIMESTAMP(3),
  "reuseDetectedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TurnAdminSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TurnAdminSession_tokenHash_key" ON "TurnAdminSession"("tokenHash");
CREATE INDEX "TurnAdminSession_familyId_generation_idx" ON "TurnAdminSession"("familyId", "generation");
CREATE INDEX "TurnAdminSession_expiresAt_revokedAt_idx" ON "TurnAdminSession"("expiresAt", "revokedAt");
