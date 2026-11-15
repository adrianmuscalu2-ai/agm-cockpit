-- Local evaluation budget; this migration does not authorize Production use.
CREATE TABLE "LunaEvaluationBudget" (
  "scope" text PRIMARY KEY CHECK ("scope" = 'agm-luna-evaluation-20261115'),
  "limitNanoUsd" bigint NOT NULL CHECK ("limitNanoUsd" = 5000000000),
  "priorNanoUsd" bigint NOT NULL CHECK ("priorNanoUsd" >= 1000000),
  "priorEvidenceHash" text NOT NULL
);
-- Round historical $0.0005412 UP to $0.001. Never refund historical consumption.
INSERT INTO "LunaEvaluationBudget" VALUES ('agm-luna-evaluation-20261115',5000000000,1000000,
  'ecf00820aa975ab79f8f81d9c171374874ac1b240d00a1339fbf7bbab8be729a');
CREATE TABLE "LunaEvaluationReservation" (
  "callId" uuid PRIMARY KEY,
  "companyId" uuid NOT NULL REFERENCES "Company"("id"),
  "executionId" uuid NOT NULL,
  "scope" text NOT NULL REFERENCES "LunaEvaluationBudget"("scope"),
  "reservedNanoUsd" bigint NOT NULL CHECK ("reservedNanoUsd" = 100000000),
  "chargedNanoUsd" bigint CHECK ("chargedNanoUsd" >= 0),
  "state" text NOT NULL CHECK ("state" IN ('RESERVED','SETTLED','UNCONFIRMED')),
  "startedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settlementHash" text
);
CREATE TRIGGER "luna_budget_immutable" BEFORE UPDATE OR DELETE ON "LunaEvaluationBudget"
FOR EACH ROW EXECUTE FUNCTION reject_acp_mutation();
CREATE TRIGGER "luna_budget_no_truncate" BEFORE TRUNCATE ON "LunaEvaluationBudget"
FOR EACH STATEMENT EXECUTE FUNCTION reject_acp_mutation();

CREATE TRIGGER "luna_reservation_no_delete" BEFORE DELETE ON "LunaEvaluationReservation"
FOR EACH ROW EXECUTE FUNCTION reject_acp_mutation();
CREATE TRIGGER "luna_reservation_no_truncate" BEFORE TRUNCATE ON "LunaEvaluationReservation"
FOR EACH STATEMENT EXECUTE FUNCTION reject_acp_mutation();
