-- Preserve existing lifecycle events and forbid mutation by application writers.
-- This does not modify existing rows or confer trust on the event's author.
CREATE FUNCTION "reject_universal_lifecycle_event_mutation"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'UNIVERSAL_LIFECYCLE_EVENT_APPEND_ONLY' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "UniversalLifecycleEvent_append_only_rows"
BEFORE UPDATE OR DELETE ON "UniversalLifecycleEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_universal_lifecycle_event_mutation"();

CREATE TRIGGER "UniversalLifecycleEvent_append_only_truncate"
BEFORE TRUNCATE ON "UniversalLifecycleEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_universal_lifecycle_event_mutation"();
