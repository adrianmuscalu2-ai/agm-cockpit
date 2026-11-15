-- One-way accounting handoff. Presence freezes the source rehearsal; Production
-- remains disabled until the SAME verified receipt is imported in its release window.
-- No credential, authority or Production activation is provisioned by this migration.
CREATE TABLE "LunaBudgetHandoff" (
  "scope" text PRIMARY KEY REFERENCES "LunaEvaluationBudget"("scope"),
  "sourceDatabase" text NOT NULL CHECK ("sourceDatabase"='agm_cockpit_191_rehearsal'),
  "targetDatabase" text NOT NULL CHECK ("targetDatabase"='agm'),
  "carriedNanoUsd" bigint NOT NULL CHECK ("carriedNanoUsd" BETWEEN 1000000 AND 5000000000),
  "receiptHash" varchar(64) NOT NULL CHECK ("receiptHash" ~ '^[a-f0-9]{64}$'),
  "receipt" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER "luna_handoff_immutable" BEFORE UPDATE OR DELETE ON "LunaBudgetHandoff"
FOR EACH ROW EXECUTE FUNCTION reject_acp_mutation();
CREATE TRIGGER "luna_handoff_no_truncate" BEFORE TRUNCATE ON "LunaBudgetHandoff"
FOR EACH STATEMENT EXECUTE FUNCTION reject_acp_mutation();
