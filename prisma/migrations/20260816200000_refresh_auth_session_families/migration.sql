-- Deliberately separated from the DSAR expand-only Production migration.
-- This migration is not part of the authorized DSAR Production deployment.
ALTER TABLE "AuthSession"
  ADD COLUMN "familyId" UUID,
  ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "replacedAt" TIMESTAMP(3),
  ADD COLUMN "reuseDetectedAt" TIMESTAMP(3);

UPDATE "AuthSession" SET "familyId" = "id" WHERE "familyId" IS NULL;
ALTER TABLE "AuthSession" ALTER COLUMN "familyId" SET NOT NULL;
CREATE INDEX "AuthSession_familyId_generation_idx" ON "AuthSession"("familyId", "generation");
