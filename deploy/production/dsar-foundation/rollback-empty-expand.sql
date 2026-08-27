DO $rollback$
BEGIN
  IF EXISTS (SELECT 1 FROM "DataSubjectRequest" LIMIT 1)
    OR EXISTS (SELECT 1 FROM "DataRightsExternalRequest" LIMIT 1)
    OR EXISTS (SELECT 1 FROM "SubjectDataIndex" LIMIT 1) THEN
    RAISE EXCEPTION 'DSAR_ROLLBACK_REFUSED_NONEMPTY_TABLE';
  END IF;
END $rollback$;

DROP TABLE "SubjectDataIndex";
DROP TABLE "DataRightsExternalRequest";
DROP TABLE "DataSubjectRequest";

