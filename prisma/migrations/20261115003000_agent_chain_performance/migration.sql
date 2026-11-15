-- Independent append-only observation ledger; existing journals are untouched.
CREATE TABLE "AgentChainPerformanceEvent" (
  "companyId" uuid NOT NULL REFERENCES "Company"("id"),
  "eventId" uuid NOT NULL,
  "recordedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedBy" text NOT NULL,
  "payload" jsonb NOT NULL,
  "payloadHash" varchar(64) NOT NULL,
  PRIMARY KEY ("companyId", "eventId")
);
CREATE INDEX "AgentChainPerformanceEvent_tenant_time" ON "AgentChainPerformanceEvent" ("companyId", "recordedAt", "eventId");
CREATE UNIQUE INDEX "acp_one_correction_per_event" ON "AgentChainPerformanceEvent" ("companyId", ("payload"->>'supersedesEventId')) WHERE "payload" ? 'supersedesEventId';
CREATE FUNCTION reject_acp_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ACP ledger is append-only'; END $$;
CREATE TRIGGER "acp_append_only" BEFORE UPDATE OR DELETE ON "AgentChainPerformanceEvent"
FOR EACH ROW EXECUTE FUNCTION reject_acp_mutation();
CREATE TRIGGER "acp_no_truncate" BEFORE TRUNCATE ON "AgentChainPerformanceEvent"
FOR EACH STATEMENT EXECUTE FUNCTION reject_acp_mutation();
