CREATE TABLE "OperationalLinguistBaseline" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "digest" VARCHAR(80) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PREPARED',
  "authorityEpoch" INTEGER NOT NULL DEFAULT 0,
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalLinguistBaseline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalLinguistPublisher" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "baselineId" UUID NOT NULL,
  "authorityEpoch" INTEGER NOT NULL,
  "writerId" VARCHAR(100) NOT NULL,
  "writerVersion" VARCHAR(32) NOT NULL,
  "buildRevision" VARCHAR(40) NOT NULL,
  "workflowRef" VARCHAR(240) NOT NULL,
  "runId" VARCHAR(32) NOT NULL,
  "runAttempt" VARCHAR(16) NOT NULL,
  "authorityRole" VARCHAR(48) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "OperationalLinguistPublisher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalLinguistEvidence" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "baselineId" UUID NOT NULL,
  "publisherId" UUID NOT NULL,
  "componentId" VARCHAR(80) NOT NULL,
  "language" VARCHAR(2) NOT NULL,
  "authorityScope" VARCHAR(180) NOT NULL,
  "mandateId" UUID NOT NULL,
  "mandateVersion" INTEGER NOT NULL,
  "schemaVersion" VARCHAR(80) NOT NULL,
  "baselineVersion" VARCHAR(80) NOT NULL,
  "baselineDigest" VARCHAR(80) NOT NULL,
  "operationalState" VARCHAR(16) NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorityEpoch" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "contractVersion" VARCHAR(80) NOT NULL,
  "contractDigest" VARCHAR(80) NOT NULL,
  "catalogDigest" VARCHAR(80) NOT NULL,
  "appCount" INTEGER NOT NULL,
  "operationalCount" INTEGER NOT NULL,
  "carMoverCount" INTEGER NOT NULL,
  "premiumCount" INTEGER NOT NULL,
  "totalCount" INTEGER NOT NULL,
  "errorCount" INTEGER NOT NULL,
  "errorCodes" JSONB NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  CONSTRAINT "OperationalLinguistEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalLinguistState" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "baselineId" UUID NOT NULL,
  "componentId" VARCHAR(80) NOT NULL,
  "language" VARCHAR(2) NOT NULL,
  "authorityScope" VARCHAR(180) NOT NULL,
  "mandateId" UUID NOT NULL,
  "mandateVersion" INTEGER NOT NULL,
  "currentEvidenceId" UUID NOT NULL,
  "operationalState" VARCHAR(16) NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "authorityEpoch" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "contractVersion" VARCHAR(80) NOT NULL,
  "contractDigest" VARCHAR(80) NOT NULL,
  "catalogDigest" VARCHAR(80) NOT NULL,
  "appCount" INTEGER NOT NULL,
  "operationalCount" INTEGER NOT NULL,
  "carMoverCount" INTEGER NOT NULL,
  "premiumCount" INTEGER NOT NULL,
  "totalCount" INTEGER NOT NULL,
  "errorCount" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalLinguistState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalLinguistReceipt" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "baselineId" UUID NOT NULL,
  "evidenceId" UUID NOT NULL,
  "componentId" VARCHAR(80) NOT NULL,
  "outcome" VARCHAR(16) NOT NULL,
  "reasonCode" VARCHAR(80) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalLinguistReceipt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OperationalLinguistBaseline" ADD CONSTRAINT "OperationalLinguistBaseline_contract_check"
  CHECK ("version" = 'agm.operational-linguist.v1' AND "digest" = 'sha256:f5c9ffef6cdd240f7788f024942f00f606dfb208032fc3ed3d558bee69a22820' AND "status" IN ('PREPARED', 'ACTIVE', 'SUSPENDED') AND "authorityEpoch" >= 0);
ALTER TABLE "OperationalLinguistPublisher" ADD CONSTRAINT "OperationalLinguistPublisher_provenance_check"
  CHECK ("authorityEpoch" > 0 AND "writerId" = 'agm.operational-linguist.workflow-auditor' AND "writerVersion" = '1.0.0' AND "buildRevision" ~ '^[0-9a-f]{40}$' AND "authorityRole" IN ('DEPLOYMENT_PROVISIONER', 'AGENT_RUNTIME_CONTINUITY'));
ALTER TABLE "OperationalLinguistEvidence" ADD CONSTRAINT "OperationalLinguistEvidence_canonical_check"
  CHECK (
    "schemaVersion" = 'agm.operational-linguist-evidence.v1'
    AND "baselineVersion" = 'agm.operational-linguist.v1'
    AND "baselineDigest" = 'sha256:f5c9ffef6cdd240f7788f024942f00f606dfb208032fc3ed3d558bee69a22820'
    AND "operationalState" = 'ONLINE'
    AND "contractVersion" = 'agm.linguistic-resource-counts.v1'
    AND "contractDigest" = 'sha256:8c2207d91a261c69af17eca9746867c14c603dcc0edc061d74c88330ceb721b1'
    AND "appCount" = 1182 AND "operationalCount" = 308 AND "carMoverCount" = 37 AND "premiumCount" = 199 AND "totalCount" = 1726
    AND "errorCount" = 0 AND jsonb_array_length("errorCodes") = 0
    AND "authorityEpoch" > 0 AND "sequence" > 0 AND "mandateVersion" > 0 AND "payloadHash" ~ '^[0-9a-f]{64}$'
    AND (("language" = 'it' AND "componentId" = 'premium-linguist-it' AND "authorityScope" = 'premium.linguistic.it' AND "catalogDigest" = 'sha256:5cf389fc2f2e60ff9d9a0dd6acd008ee370b07065e85e41f53f95610e260ea25')
      OR ("language" = 'es' AND "componentId" = 'premium-linguist-es' AND "authorityScope" = 'premium.linguistic.es' AND "catalogDigest" = 'sha256:04d8f19c417113ef80550510007987aac56883461d4570eb15f58274afcece6f')
      OR ("language" = 'sv' AND "componentId" = 'premium-linguist-sv' AND "authorityScope" = 'premium.linguistic.sv' AND "catalogDigest" = 'sha256:d9dae5ba8701281e4c21f258926702b517c729d608e4d23d0ddcbcae0c2ef90f'))
  );
ALTER TABLE "OperationalLinguistState" ADD CONSTRAINT "OperationalLinguistState_canonical_check"
  CHECK (
    "operationalState" = 'ONLINE'
    AND "contractVersion" = 'agm.linguistic-resource-counts.v1'
    AND "contractDigest" = 'sha256:8c2207d91a261c69af17eca9746867c14c603dcc0edc061d74c88330ceb721b1'
    AND "appCount" = 1182 AND "operationalCount" = 308 AND "carMoverCount" = 37 AND "premiumCount" = 199 AND "totalCount" = 1726
    AND "errorCount" = 0 AND "authorityEpoch" > 0 AND "sequence" > 0 AND "revision" > 0 AND "mandateVersion" > 0
    AND (("language" = 'it' AND "componentId" = 'premium-linguist-it' AND "authorityScope" = 'premium.linguistic.it' AND "catalogDigest" = 'sha256:5cf389fc2f2e60ff9d9a0dd6acd008ee370b07065e85e41f53f95610e260ea25')
      OR ("language" = 'es' AND "componentId" = 'premium-linguist-es' AND "authorityScope" = 'premium.linguistic.es' AND "catalogDigest" = 'sha256:04d8f19c417113ef80550510007987aac56883461d4570eb15f58274afcece6f')
      OR ("language" = 'sv' AND "componentId" = 'premium-linguist-sv' AND "authorityScope" = 'premium.linguistic.sv' AND "catalogDigest" = 'sha256:d9dae5ba8701281e4c21f258926702b517c729d608e4d23d0ddcbcae0c2ef90f'))
  );
ALTER TABLE "OperationalLinguistReceipt" ADD CONSTRAINT "OperationalLinguistReceipt_acceptance_check"
  CHECK ("outcome" = 'ACCEPTED' AND "reasonCode" = 'CANONICAL_EVIDENCE_PERSISTED' AND "payloadHash" ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX "OperationalLinguistBaseline_companyId_version_key" ON "OperationalLinguistBaseline"("companyId", "version");
CREATE INDEX "OperationalLinguistBaseline_companyId_status_idx" ON "OperationalLinguistBaseline"("companyId", "status");
CREATE UNIQUE INDEX "OperationalLinguistPublisher_baselineId_authorityEpoch_key" ON "OperationalLinguistPublisher"("baselineId", "authorityEpoch");
CREATE INDEX "OperationalLinguistPublisher_companyId_expiresAt_revokedAt_idx" ON "OperationalLinguistPublisher"("companyId", "expiresAt", "revokedAt");
CREATE UNIQUE INDEX "OperationalLinguistEvidence_publisherId_componentId_sequence_key" ON "OperationalLinguistEvidence"("publisherId", "componentId", "sequence");
CREATE INDEX "OperationalLinguistEvidence_companyId_componentId_acceptedAt_idx" ON "OperationalLinguistEvidence"("companyId", "componentId", "acceptedAt");
CREATE INDEX "OperationalLinguistEvidence_baselineId_authorityEpoch_componentId_sequence_idx" ON "OperationalLinguistEvidence"("baselineId", "authorityEpoch", "componentId", "sequence");
CREATE UNIQUE INDEX "OperationalLinguistState_currentEvidenceId_key" ON "OperationalLinguistState"("currentEvidenceId");
CREATE UNIQUE INDEX "OperationalLinguistState_companyId_componentId_key" ON "OperationalLinguistState"("companyId", "componentId");
CREATE INDEX "OperationalLinguistState_baselineId_operationalState_observedAt_idx" ON "OperationalLinguistState"("baselineId", "operationalState", "observedAt");
CREATE UNIQUE INDEX "OperationalLinguistReceipt_evidenceId_key" ON "OperationalLinguistReceipt"("evidenceId");
CREATE INDEX "OperationalLinguistReceipt_companyId_componentId_acceptedAt_idx" ON "OperationalLinguistReceipt"("companyId", "componentId", "acceptedAt");

ALTER TABLE "OperationalLinguistBaseline" ADD CONSTRAINT "OperationalLinguistBaseline_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistPublisher" ADD CONSTRAINT "OperationalLinguistPublisher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistPublisher" ADD CONSTRAINT "OperationalLinguistPublisher_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "OperationalLinguistBaseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistEvidence" ADD CONSTRAINT "OperationalLinguistEvidence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistEvidence" ADD CONSTRAINT "OperationalLinguistEvidence_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "OperationalLinguistBaseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistEvidence" ADD CONSTRAINT "OperationalLinguistEvidence_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "OperationalLinguistPublisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistState" ADD CONSTRAINT "OperationalLinguistState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistState" ADD CONSTRAINT "OperationalLinguistState_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "OperationalLinguistBaseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistState" ADD CONSTRAINT "OperationalLinguistState_currentEvidenceId_fkey" FOREIGN KEY ("currentEvidenceId") REFERENCES "OperationalLinguistEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistReceipt" ADD CONSTRAINT "OperationalLinguistReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistReceipt" ADD CONSTRAINT "OperationalLinguistReceipt_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "OperationalLinguistBaseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalLinguistReceipt" ADD CONSTRAINT "OperationalLinguistReceipt_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "OperationalLinguistEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION agm_block_legacy_operational_linguist_heartbeat()
RETURNS trigger AS $$
BEGIN
  IF NEW."componentId" IN ('premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv') THEN
    PERFORM pg_advisory_xact_lock(hashtext('agm-operational-linguist-v1:' || NEW."companyId"::text));
    IF EXISTS (
      SELECT 1 FROM "OperationalLinguistBaseline"
      WHERE "companyId" = NEW."companyId"
        AND "version" = 'agm.operational-linguist.v1'
        AND "status" = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'LEGACY_OPERATIONAL_LINGUIST_HEARTBEAT_FENCED' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ComponentHeartbeat_operational_linguist_v1_fence"
BEFORE INSERT OR UPDATE ON "ComponentHeartbeat"
FOR EACH ROW EXECUTE FUNCTION agm_block_legacy_operational_linguist_heartbeat();

CREATE OR REPLACE FUNCTION agm_operational_linguist_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'OPERATIONAL_LINGUIST_V1_APPEND_ONLY' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OperationalLinguistEvidence_append_only"
BEFORE UPDATE OR DELETE ON "OperationalLinguistEvidence"
FOR EACH ROW EXECUTE FUNCTION agm_operational_linguist_append_only();

CREATE TRIGGER "OperationalLinguistReceipt_append_only"
BEFORE UPDATE OR DELETE ON "OperationalLinguistReceipt"
FOR EACH ROW EXECUTE FUNCTION agm_operational_linguist_append_only();
