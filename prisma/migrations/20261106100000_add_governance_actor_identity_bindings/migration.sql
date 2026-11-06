-- Governance V2 actor <-> authenticated identity bindings. Additive and append-only.
-- Revocation is a new row; the latest row per (principal_type, principal_id) is authoritative.

CREATE TABLE IF NOT EXISTS agm_governance.actor_identity_bindings (
  binding_id bigserial PRIMARY KEY,
  actor_id text NOT NULL REFERENCES agm_governance.actor_principals(actor_id),
  principal_type text NOT NULL CHECK (principal_type IN ('MACHINE_IDENTITY', 'HUMAN_USER')),
  principal_id text NOT NULL,
  company_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('BOUND', 'REVOKED')),
  decision_ref text NOT NULL,
  recorded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS actor_identity_bindings_principal_idx
  ON agm_governance.actor_identity_bindings (principal_type, principal_id, binding_id DESC);

DROP TRIGGER IF EXISTS actor_identity_bindings_no_update ON agm_governance.actor_identity_bindings;
CREATE TRIGGER actor_identity_bindings_no_update BEFORE UPDATE ON agm_governance.actor_identity_bindings FOR EACH ROW EXECUTE FUNCTION agm_governance.reject_event_mutation();
DROP TRIGGER IF EXISTS actor_identity_bindings_no_delete ON agm_governance.actor_identity_bindings;
CREATE TRIGGER actor_identity_bindings_no_delete BEFORE DELETE ON agm_governance.actor_identity_bindings FOR EACH ROW EXECUTE FUNCTION agm_governance.reject_event_mutation();
