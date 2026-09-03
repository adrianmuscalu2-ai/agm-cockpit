CREATE TABLE "MachineIdentity" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "subject" VARCHAR(160) NOT NULL,
  "issuer" VARCHAR(160) NOT NULL,
  "audience" VARCHAR(160) NOT NULL,
  "scopes" JSONB NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MachineIdentity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MachineCredential" (
  "id" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "secretHash" VARCHAR(64) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachineCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MachineIdentity_companyId_subject_key" ON "MachineIdentity"("companyId", "subject");
CREATE INDEX "MachineIdentity_companyId_status_idx" ON "MachineIdentity"("companyId", "status");
CREATE UNIQUE INDEX "MachineCredential_secretHash_key" ON "MachineCredential"("secretHash");
CREATE INDEX "MachineCredential_identityId_expiresAt_revokedAt_idx" ON "MachineCredential"("identityId", "expiresAt", "revokedAt");
ALTER TABLE "MachineIdentity" ADD CONSTRAINT "MachineIdentity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineCredential" ADD CONSTRAINT "MachineCredential_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "MachineIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
