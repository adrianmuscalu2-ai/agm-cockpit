BEGIN;

DO $$
DECLARE observation_count integer;
DECLARE job_count integer;
BEGIN
  SELECT count(*) INTO observation_count FROM "ProviderUsageEvent" WHERE "providerId"='agm-routing-policy';
  SELECT count(*) INTO job_count FROM "CarMoverJob" WHERE "moduleId"='field-measurement';
  IF observation_count <> 0 THEN
    RAISE EXCEPTION 'FIELD_OBSERVATIONS_EXIST_UUID_NORMALIZATION_PROHIBITED';
  END IF;
  IF job_count <> 120 THEN
    RAISE EXCEPTION 'FIELD_JOB_COUNT_MISMATCH_EXPECTED_120_GOT_%',job_count;
  END IF;
END $$;

UPDATE "CarMoverVehicleSubject"
SET id=('f5000000-0000-4000-8000-'||lpad((details->>'fieldCaseNumber'),12,'0'))::uuid,
    "updatedAt"=now()
WHERE "companyId"='f1000000-0000-4000-8000-000000000001'
  AND "productId"='agm-car-mover'
  AND details->>'fieldCaseNumber' IS NOT NULL;

UPDATE "CarMoverJob"
SET id=('f6000000-0000-4000-8000-'||lpad(substring("sourceReference" from 12),12,'0'))::uuid,
    "updatedAt"=now()
WHERE "companyId"='f1000000-0000-4000-8000-000000000001'
  AND "productId"='agm-car-mover'
  AND "moduleId"='field-measurement'
  AND "sourceReference" ~ '^FIELD-CASE-[0-9]{4}$';

DO $$
DECLARE invalid_count integer;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM "CarMoverJob"
  WHERE "moduleId"='field-measurement'
    AND id::text !~ '^f6000000-0000-4000-8[0-9a-f]{3}-[0-9a-f]{12}$';
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'FIELD_UUID_NORMALIZATION_INCOMPLETE_%',invalid_count;
  END IF;
END $$;

COMMIT;
