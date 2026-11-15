-- Protect the transferred ceiling against old application versions and direct writers.
-- Row updates also force stale REPEATABLE READ writers to serialize/fail safely.
CREATE TABLE "LunaBudgetSourceFence" (
  scope text PRIMARY KEY REFERENCES "LunaEvaluationBudget"(scope),
  frozen boolean NOT NULL DEFAULT false,
  generation bigint NOT NULL DEFAULT 0
);
INSERT INTO "LunaBudgetSourceFence" (scope,frozen)
SELECT b.scope, EXISTS(SELECT 1 FROM "LunaBudgetHandoff" h WHERE h.scope=b.scope AND h."sourceDatabase"=current_database())
FROM "LunaEvaluationBudget" b;
CREATE FUNCTION protect_luna_fence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR (OLD.frozen AND NOT NEW.frozen) THEN RAISE EXCEPTION 'LUNA_FENCE_IRREVERSIBLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER luna_fence_irreversible BEFORE UPDATE OR DELETE ON "LunaBudgetSourceFence"
FOR EACH ROW EXECUTE FUNCTION protect_luna_fence();
CREATE TRIGGER luna_fence_no_truncate BEFORE TRUNCATE ON "LunaBudgetSourceFence"
FOR EACH STATEMENT EXECUTE FUNCTION reject_acp_mutation();
CREATE FUNCTION freeze_luna_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."sourceDatabase"=current_database() THEN
    PERFORM pg_advisory_xact_lock(191,61115);
    UPDATE "LunaBudgetSourceFence" SET frozen=true,generation=generation+1 WHERE scope=NEW.scope;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER luna_handoff_freezes_source AFTER INSERT ON "LunaBudgetHandoff"
FOR EACH ROW EXECUTE FUNCTION freeze_luna_source();
CREATE FUNCTION enforce_luna_source_fence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE is_frozen boolean;
BEGIN
  IF current_database()='agm_cockpit_191_rehearsal' THEN
    PERFORM pg_advisory_xact_lock(191,61115);
    UPDATE "LunaBudgetSourceFence" SET generation=generation+1 WHERE scope=NEW.scope RETURNING frozen INTO is_frozen;
    IF is_frozen IS DISTINCT FROM false THEN RAISE EXCEPTION 'LUNA_SOURCE_BUDGET_FROZEN_DB'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER luna_reservation_source_fence BEFORE INSERT ON "LunaEvaluationReservation"
FOR EACH ROW EXECUTE FUNCTION enforce_luna_source_fence();
