-- Run after the migration inside a transaction that will be rolled back.
DO $$
DECLARE
  event_id uuid;
  blocked boolean;
BEGIN
  SELECT id INTO event_id FROM "UniversalLifecycleEvent" LIMIT 1;
  IF event_id IS NULL THEN RAISE EXCEPTION 'EXISTING_EVENT_REQUIRED'; END IF;

  INSERT INTO "UniversalLifecycleEvent"
    (id, "eventType", "sessionId", "mandateId", actor, "correlationId",
     "previousEventId", "previousDigest", "eventDigest", payload, "occurredAt")
  SELECT '00000000-0000-4000-8000-000000000001'::uuid, 'APPEND_ONLY_TEST',
         "sessionId", "mandateId", actor, "correlationId", id, "eventDigest",
         repeat('a', 64), payload, now()
  FROM "UniversalLifecycleEvent" WHERE id = event_id;

  blocked := false;
  BEGIN
    UPDATE "UniversalLifecycleEvent" SET "eventType" = "eventType" WHERE id = event_id;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'UPDATE_NOT_BLOCKED'; END IF;

  blocked := false;
  BEGIN
    DELETE FROM "UniversalLifecycleEvent" WHERE id = event_id;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'DELETE_NOT_BLOCKED'; END IF;

  blocked := false;
  BEGIN
    TRUNCATE "UniversalLifecycleEvent";
  EXCEPTION WHEN object_not_in_prerequisite_state THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'TRUNCATE_NOT_BLOCKED'; END IF;

  RAISE NOTICE 'APPEND_ONLY_INSERT_UPDATE_DELETE_TRUNCATE: PASS';
END;
$$;
