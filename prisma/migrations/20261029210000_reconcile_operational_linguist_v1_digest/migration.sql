-- Reconcile the V1 contract after the canonical catalog audit changed the
-- baseline and per-language catalog digests. Historical evidence is append-only
-- and must remain readable, so the new checks are NOT VALID: PostgreSQL still
-- enforces them for every new row without rewriting historical evidence.

BEGIN;

ALTER TABLE "OperationalLinguistBaseline"
  DROP CONSTRAINT IF EXISTS "OperationalLinguistBaseline_contract_check";

UPDATE "OperationalLinguistBaseline"
SET "digest" = 'sha256:3888efd48d32036e9a0b0f9880859938c26519e1d190a863f04f50204e2fbdf4'
WHERE "version" = 'agm.operational-linguist.v1'
  AND "digest" = 'sha256:f5c9ffef6cdd240f7788f024942f00f606dfb208032fc3ed3d558bee69a22820';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "OperationalLinguistBaseline"
    WHERE "version" = 'agm.operational-linguist.v1'
      AND "digest" <> 'sha256:3888efd48d32036e9a0b0f9880859938c26519e1d190a863f04f50204e2fbdf4'
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_LINGUIST_V1_UNSUPPORTED_BASELINE_DIGEST';
  END IF;
END $$;

ALTER TABLE "OperationalLinguistBaseline"
  ADD CONSTRAINT "OperationalLinguistBaseline_contract_check"
  CHECK (
    "version" = 'agm.operational-linguist.v1'
    AND "digest" = 'sha256:3888efd48d32036e9a0b0f9880859938c26519e1d190a863f04f50204e2fbdf4'
    AND "status" IN ('PREPARED', 'ACTIVE', 'SUSPENDED')
    AND "authorityEpoch" >= 0
  );

ALTER TABLE "OperationalLinguistEvidence"
  DROP CONSTRAINT IF EXISTS "OperationalLinguistEvidence_canonical_check";

ALTER TABLE "OperationalLinguistEvidence"
  ADD CONSTRAINT "OperationalLinguistEvidence_canonical_check"
  CHECK (
    "schemaVersion" = 'agm.operational-linguist-evidence.v1'
    AND "baselineVersion" = 'agm.operational-linguist.v1'
    AND "baselineDigest" = 'sha256:3888efd48d32036e9a0b0f9880859938c26519e1d190a863f04f50204e2fbdf4'
    AND "operationalState" = 'ONLINE'
    AND "contractVersion" = 'agm.linguistic-resource-counts.v1'
    AND "contractDigest" = 'sha256:8c2207d91a261c69af17eca9746867c14c603dcc0edc061d74c88330ceb721b1'
    AND "appCount" = 1182 AND "operationalCount" = 308 AND "carMoverCount" = 37 AND "premiumCount" = 199 AND "totalCount" = 1726
    AND "errorCount" = 0 AND jsonb_array_length("errorCodes") = 0
    AND "authorityEpoch" > 0 AND "sequence" > 0 AND "mandateVersion" > 0 AND "payloadHash" ~ '^[0-9a-f]{64}$'
    AND (("language" = 'it' AND "componentId" = 'premium-linguist-it' AND "authorityScope" = 'premium.linguistic.it' AND "catalogDigest" = 'sha256:e91e75fd69ab2c000e515fa987364859581f00fe72264a2e8a3205f6cf15caba')
      OR ("language" = 'es' AND "componentId" = 'premium-linguist-es' AND "authorityScope" = 'premium.linguistic.es' AND "catalogDigest" = 'sha256:7fceb6c9f8819d1cd15878bf0363922954144729bda71b4619a600c82849ca50')
      OR ("language" = 'sv' AND "componentId" = 'premium-linguist-sv' AND "authorityScope" = 'premium.linguistic.sv' AND "catalogDigest" = 'sha256:2545d9bcee9d5201cef1145ac64df9603396c39abff2f685a22baaa0bf3bc8a8'))
  ) NOT VALID;

ALTER TABLE "OperationalLinguistState"
  DROP CONSTRAINT IF EXISTS "OperationalLinguistState_canonical_check";

ALTER TABLE "OperationalLinguistState"
  ADD CONSTRAINT "OperationalLinguistState_canonical_check"
  CHECK (
    "operationalState" = 'ONLINE'
    AND "contractVersion" = 'agm.linguistic-resource-counts.v1'
    AND "contractDigest" = 'sha256:8c2207d91a261c69af17eca9746867c14c603dcc0edc061d74c88330ceb721b1'
    AND "appCount" = 1182 AND "operationalCount" = 308 AND "carMoverCount" = 37 AND "premiumCount" = 199 AND "totalCount" = 1726
    AND "errorCount" = 0 AND "authorityEpoch" > 0 AND "sequence" > 0 AND "revision" > 0 AND "mandateVersion" > 0
    AND (("language" = 'it' AND "componentId" = 'premium-linguist-it' AND "authorityScope" = 'premium.linguistic.it' AND "catalogDigest" = 'sha256:e91e75fd69ab2c000e515fa987364859581f00fe72264a2e8a3205f6cf15caba')
      OR ("language" = 'es' AND "componentId" = 'premium-linguist-es' AND "authorityScope" = 'premium.linguistic.es' AND "catalogDigest" = 'sha256:7fceb6c9f8819d1cd15878bf0363922954144729bda71b4619a600c82849ca50')
      OR ("language" = 'sv' AND "componentId" = 'premium-linguist-sv' AND "authorityScope" = 'premium.linguistic.sv' AND "catalogDigest" = 'sha256:2545d9bcee9d5201cef1145ac64df9603396c39abff2f685a22baaa0bf3bc8a8'))
  ) NOT VALID;

COMMIT;
