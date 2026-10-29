-- AGM Governance V2 persistence schema. Separate from the protected AGM candidate schema.
-- Additive only; this file is not applied to Production by this mandate.

CREATE SCHEMA IF NOT EXISTS agm_governance;

CREATE TABLE IF NOT EXISTS agm_governance.actor_principals (
  actor_id text PRIMARY KEY,
  display_name text NOT NULL,
  roles jsonb NOT NULL,
  can_propose boolean NOT NULL DEFAULT false,
  can_validate boolean NOT NULL DEFAULT false,
  can_execute boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agm_governance.proposals (
  proposal_id text PRIMARY KEY,
  semantic_title text NOT NULL,
  description text NOT NULL,
  scope text NOT NULL,
  proposal_type text NOT NULL,
  proposer_id text NOT NULL REFERENCES agm_governance.actor_principals(actor_id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  candidate_ref text NOT NULL,
  candidate_digest text NOT NULL,
  base_revision text NOT NULL,
  affected_components jsonb NOT NULL,
  affected_facts jsonb NOT NULL,
  correlation_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','REVIEWED','ACCEPTED_FOR_CHANGE_CONTROL','SUPERSEDED','REJECTED','ABANDONED')),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_assessment_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  impact_study_ref text NOT NULL,
  dependency_graph_ref text NOT NULL,
  snapshot_ref text NOT NULL,
  version_ref text,
  pcr_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  csc_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  historical_evidence_at timestamptz,
  reconciled_at timestamptz,
  importer_id text REFERENCES agm_governance.actor_principals(actor_id)
);
CREATE INDEX IF NOT EXISTS proposals_semantic_search ON agm_governance.proposals USING gin (to_tsvector('simple', semantic_title || ' ' || description || ' ' || scope || ' ' || proposal_type || ' ' || candidate_ref || ' ' || candidate_digest));

CREATE TABLE IF NOT EXISTS agm_governance.recovery_evidence (
  recovery_evidence_id text PRIMARY KEY,
  recovery_type text NOT NULL CHECK (recovery_type IN ('RESTART','BACKUP_RESTORE','ROLLBACK_DRILL','FAILOVER_RECOVERY')),
  candidate_ref text NOT NULL,
  candidate_digest text NOT NULL,
  version_id text NOT NULL,
  proposal_id text,
  pcr_id text NOT NULL,
  snapshot_ref text NOT NULL,
  environment_class text NOT NULL CHECK (environment_class IN ('DISPOSABLE','CONTROLLED_LOCAL','STAGING','PRODUCTION')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  executor_id text NOT NULL REFERENCES agm_governance.actor_principals(actor_id),
  validator_id text REFERENCES agm_governance.actor_principals(actor_id),
  correlation_id text NOT NULL,
  backup_ref text,
  backup_sha256 text,
  source_db_ref text,
  source_environment_ref text,
  restore_target_ref text,
  destroy_verified boolean,
  restore_verified boolean,
  post_restore_startup_verified boolean,
  readiness_result text,
  critical_tests_result text,
  rollback_plan_ref text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  contract_version text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('PASS','FAIL','PARTIAL','UNKNOWN')),
  notes text,
  reason_code text,
  historical_execution_at timestamptz,
  reconciled_at timestamptz,
  importer_id text REFERENCES agm_governance.actor_principals(actor_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX IF NOT EXISTS recovery_evidence_semantic_search ON agm_governance.recovery_evidence USING gin (to_tsvector('simple', candidate_ref || ' ' || recovery_type || ' ' || COALESCE(notes,'') || ' ' || COALESCE(reason_code,'')));

CREATE TABLE IF NOT EXISTS agm_governance.canonical_source_records (
  id text PRIMARY KEY,
  fact_key text NOT NULL,
  human_title text NOT NULL,
  description text NOT NULL,
  canonical_source text NOT NULL,
  write_authority text NOT NULL,
  validator_authority text NOT NULL,
  readers jsonb NOT NULL DEFAULT '[]'::jsonb,
  precedence integer NOT NULL,
  conflict_behavior text NOT NULL,
  contract_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED')),
  activated_at timestamptz NOT NULL,
  superseded_at timestamptz,
  superseded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS canonical_source_one_active_fact ON agm_governance.canonical_source_records (fact_key) WHERE status = 'ACTIVE';

ALTER TABLE agm_governance.canonical_source_records DROP CONSTRAINT IF EXISTS canonical_source_records_status_check;
ALTER TABLE agm_governance.canonical_source_records ADD CONSTRAINT canonical_source_records_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED'));

CREATE TABLE IF NOT EXISTS agm_governance.canonical_source_changes (
  id text PRIMARY KEY,
  semantic_title text NOT NULL,
  fact_key text NOT NULL,
  old_source text NOT NULL,
  new_source text NOT NULL,
  old_write_authority text NOT NULL,
  new_write_authority text NOT NULL,
  old_precedence integer NOT NULL,
  new_precedence integer NOT NULL,
  reason text NOT NULL,
  impact_study_ref text NOT NULL,
  migration_plan_ref text NOT NULL,
  test_plan_ref text NOT NULL,
  rollback_plan_ref text NOT NULL,
  approval_status text NOT NULL CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by text,
  activated_version text,
  activated_at timestamptz,
  validation_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('DRAFT', 'IMPACT_ASSESSED', 'APPROVED', 'VALIDATED', 'ACTIVATED', 'REJECTED', 'ABORTED', 'ROLLED_BACK', 'SUPERSEDED')),
  proposer_id text NOT NULL,
  validator_id text,
  proposal_id text,
  pcr_id text,
  candidate_digest text,
  correlation_id text
);
ALTER TABLE agm_governance.canonical_source_changes ADD COLUMN IF NOT EXISTS proposal_id text;
ALTER TABLE agm_governance.canonical_source_changes ADD COLUMN IF NOT EXISTS pcr_id text;
ALTER TABLE agm_governance.canonical_source_changes ADD COLUMN IF NOT EXISTS candidate_digest text;
ALTER TABLE agm_governance.canonical_source_changes ADD COLUMN IF NOT EXISTS correlation_id text;

CREATE TABLE IF NOT EXISTS agm_governance.production_change_records (
  id text PRIMARY KEY,
  semantic_title text NOT NULL,
  description text NOT NULL,
  impact_class text NOT NULL CHECK (impact_class IN ('LOW', 'CONTROLLED', 'STRUCTURAL')),
  affected_components jsonb NOT NULL,
  affected_canonical_sources jsonb NOT NULL,
  dependency_impact_ref text NOT NULL,
  impact_study text NOT NULL,
  test_plan text NOT NULL,
  rollback_plan text NOT NULL,
  snapshot_ref text NOT NULL,
  candidate_ref text NOT NULL,
  approval_status text NOT NULL CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  deploy_revision text,
  deployment_ref text,
  post_deploy_verification text,
  final_verdict text CHECK (final_verdict IN ('PASS', 'FAIL', 'UNKNOWN')),
  related_incidents jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_csc jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposer_id text NOT NULL,
  approver_id text,
  executor_id text,
  validator_id text,
  dependency_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_change boolean NOT NULL DEFAULT false,
  migration_ref text,
  migration_risk text,
  backward_compatibility_impact text,
  proposal_id text,
  status text NOT NULL
);
ALTER TABLE agm_governance.production_change_records ADD COLUMN IF NOT EXISTS schema_change boolean NOT NULL DEFAULT false;
ALTER TABLE agm_governance.production_change_records ADD COLUMN IF NOT EXISTS migration_ref text;
ALTER TABLE agm_governance.production_change_records ADD COLUMN IF NOT EXISTS migration_risk text;
ALTER TABLE agm_governance.production_change_records ADD COLUMN IF NOT EXISTS backward_compatibility_impact text;
ALTER TABLE agm_governance.production_change_records ADD COLUMN IF NOT EXISTS proposal_id text;
ALTER TABLE agm_governance.production_change_records ADD COLUMN IF NOT EXISTS candidate_digest text;

CREATE TABLE IF NOT EXISTS agm_governance.governance_dependency_edges (
  id text PRIMARY KEY,
  source_component text NOT NULL,
  relation text NOT NULL,
  target_component text NOT NULL,
  criticality text NOT NULL,
  validation_required boolean NOT NULL,
  introduced_at timestamptz NOT NULL,
  superseded_at timestamptz
);
CREATE INDEX IF NOT EXISTS governance_dependency_source ON agm_governance.governance_dependency_edges (source_component, validation_required);

CREATE TABLE IF NOT EXISTS agm_governance.governance_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  semantic_title text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  previous_event_id text,
  relation text,
  previous_digest text,
  payload_digest text NOT NULL,
  event_digest text NOT NULL UNIQUE,
  correlation_id text NOT NULL,
  actor_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE OR REPLACE FUNCTION agm_governance.reject_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'GOVERNANCE_EVENT_APPEND_ONLY';
END;
$$;
CREATE OR REPLACE FUNCTION agm_governance.require_runtime_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(current_setting('agm.governance_context', true), '') <> 'approved' THEN
    RAISE EXCEPTION 'GOVERNANCE_STRUCTURAL_WRITE_BOUNDARY';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS governance_events_no_update ON agm_governance.governance_events;
CREATE TRIGGER governance_events_no_update BEFORE UPDATE ON agm_governance.governance_events FOR EACH ROW EXECUTE FUNCTION agm_governance.reject_event_mutation();
DROP TRIGGER IF EXISTS governance_events_no_delete ON agm_governance.governance_events;
CREATE TRIGGER governance_events_no_delete BEFORE DELETE ON agm_governance.governance_events FOR EACH ROW EXECUTE FUNCTION agm_governance.reject_event_mutation();
DROP TRIGGER IF EXISTS governance_events_runtime_write ON agm_governance.governance_events;
CREATE TRIGGER governance_events_runtime_write BEFORE INSERT ON agm_governance.governance_events FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();

CREATE TABLE IF NOT EXISTS agm_governance.version_records (
  id text PRIMARY KEY,
  semantic_title text NOT NULL,
  status text NOT NULL,
  base_revision text NOT NULL,
  commit_sha text NOT NULL,
  artifact_digests jsonb NOT NULL,
  candidate_snapshot text NOT NULL,
  validation_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  pcr_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  csc_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  incident_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  deployed_environment text,
  deployed_at timestamptz,
  rollback_revision text,
  superseded_by text,
  final_verdict text CHECK (final_verdict IN ('PASS', 'FAIL', 'UNKNOWN'))
);
ALTER TABLE agm_governance.version_records ADD COLUMN IF NOT EXISTS candidate_digest text;

CREATE TABLE IF NOT EXISTS agm_governance.snapshot_records (
  snapshot_id text PRIMARY KEY,
  semantic_title text NOT NULL,
  content_summary text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  branch text NOT NULL,
  base_commit text NOT NULL,
  worktree text NOT NULL,
  manifest_digest text NOT NULL,
  snapshot_digest text NOT NULL,
  changed_files jsonb NOT NULL,
  untracked_files jsonb NOT NULL,
  tests jsonb NOT NULL,
  related_version text,
  related_incident text,
  related_csc text,
  related_pcr text,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshot_semantic_search ON agm_governance.snapshot_records USING gin (to_tsvector('simple', semantic_title || ' ' || content_summary));

CREATE TABLE IF NOT EXISTS agm_governance.incident_forensic_records (
  incident_id text PRIMARY KEY,
  semantic_title text NOT NULL,
  symptom text NOT NULL,
  reproduction text NOT NULL,
  root_cause text NOT NULL,
  root_cause_classification text NOT NULL,
  attempted_fixes jsonb NOT NULL,
  applied_remediation text NOT NULL,
  test_evidence jsonb NOT NULL,
  validator text NOT NULL,
  human_validation text,
  introduced_version text,
  fixed_version text,
  related_csc jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_pcr jsonb NOT NULL DEFAULT '[]'::jsonb,
  prevention text NOT NULL,
  similar_incidents jsonb NOT NULL DEFAULT '[]'::jsonb,
  closure_evidence text
);

CREATE TABLE IF NOT EXISTS agm_governance.worktree_records (
  worktree_id text PRIMARY KEY,
  semantic_title text NOT NULL,
  description text NOT NULL,
  path text NOT NULL UNIQUE,
  branch text NOT NULL,
  base_commit text NOT NULL,
  purpose_phase text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'FROZEN', 'CANDIDATE', 'PRESERVE_REQUIRED', 'SUPERSEDED', 'ORPHANED', 'ARCHIVED', 'SAFE_TO_REMOVE')),
  owner_executor text NOT NULL,
  candidate_ref text,
  snapshot_ref text,
  modified_files_count integer NOT NULL CHECK (modified_files_count >= 0),
  untracked_files_count integer NOT NULL CHECK (untracked_files_count >= 0),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  migration_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_activity_at timestamptz NOT NULL,
  tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_incident text,
  related_csc text,
  related_pcr text,
  related_version text,
  preservation_status text NOT NULL,
  safe_to_remove boolean NOT NULL DEFAULT false,
  removal_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agm_governance.break_glass_authorizations (
  id text PRIMARY KEY,
  authorized_human_id text NOT NULL,
  authority_role text NOT NULL,
  requester_id text NOT NULL,
  incident_id text NOT NULL,
  reason text NOT NULL,
  scope_component text NOT NULL,
  scope_operation text NOT NULL,
  release_version text NOT NULL,
  commit_sha text NOT NULL,
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  backup_ref text NOT NULL,
  snapshot_ref text NOT NULL,
  rollback_plan text NOT NULL,
  expected_impact text NOT NULL,
  risk_acceptance text NOT NULL,
  correlation_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('AUTHORIZED','EXECUTED','VALIDATED','FAILED','EXPIRED')),
  executor_id text,
  validator_id text,
  validation_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > started_at),
  CHECK (authorized_human_id <> requester_id)
);
CREATE INDEX IF NOT EXISTS break_glass_search ON agm_governance.break_glass_authorizations USING gin (to_tsvector('simple', reason || ' ' || incident_id || ' ' || scope_component || ' ' || scope_operation));
CREATE INDEX IF NOT EXISTS worktree_semantic_search ON agm_governance.worktree_records USING gin (to_tsvector('simple', semantic_title || ' ' || description || ' ' || purpose_phase));

CREATE TABLE IF NOT EXISTS agm_governance.risk_knowledge_assessments (
  assessment_id text PRIMARY KEY,
  proposal_id text NOT NULL,
  pcr_id text,
  generated_at timestamptz NOT NULL,
  scope text NOT NULL,
  affected_components jsonb NOT NULL,
  canonical_facts jsonb NOT NULL,
  direct_dependencies jsonb NOT NULL,
  transitive_dependencies jsonb NOT NULL,
  unknown_impact jsonb NOT NULL,
  historical_regression_impact jsonb NOT NULL,
  relevant_incidents jsonb NOT NULL,
  relevant_versions jsonb NOT NULL,
  relevant_cscs jsonb NOT NULL,
  relevant_pcrs jsonb NOT NULL,
  relevant_snapshots jsonb NOT NULL,
  remediation_evidence jsonb NOT NULL,
  precedent_summary text NOT NULL,
  risk_findings jsonb NOT NULL,
  unknowns jsonb NOT NULL,
  mandatory_tests jsonb NOT NULL,
  recommended_controls jsonb NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('ALLOW','ALLOW_WITH_CONDITIONS','REVIEW_REQUIRED','BLOCK','INSUFFICIENT_EVIDENCE')),
  conditions jsonb NOT NULL,
  evidence_strength text NOT NULL CHECK (evidence_strength IN ('STRONG','MODERATE','WEAK','INSUFFICIENT')),
  confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  correlation_id text NOT NULL,
  human_override jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS risk_knowledge_semantic_search ON agm_governance.risk_knowledge_assessments USING gin (to_tsvector('simple', scope || ' ' || precedent_summary));

-- Structural Governance tables are writable only through the named runtime
-- transaction boundary. The runtime sets this transaction-local marker; direct
-- SQL mutation without that boundary is rejected.
CREATE OR REPLACE FUNCTION agm_governance.require_runtime_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(current_setting('agm.governance_context', true), '') <> 'approved' THEN
    RAISE EXCEPTION 'GOVERNANCE_STRUCTURAL_WRITE_BOUNDARY';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION agm_governance.require_snapshot_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('CANDIDATE', 'PRESERVED', 'PROMOTED')
     AND (length(btrim(NEW.semantic_title)) = 0 OR length(btrim(NEW.base_commit)) = 0
       OR length(btrim(NEW.worktree)) = 0 OR length(btrim(NEW.manifest_digest)) = 0
       OR length(btrim(NEW.snapshot_digest)) = 0) THEN
    RAISE EXCEPTION 'SNAPSHOT_INTEGRITY_INCOMPLETE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS canonical_sources_runtime_write ON agm_governance.canonical_source_records;
CREATE TRIGGER canonical_sources_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.canonical_source_records FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS canonical_source_changes_runtime_write ON agm_governance.canonical_source_changes;
CREATE TRIGGER canonical_source_changes_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.canonical_source_changes FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS production_changes_runtime_write ON agm_governance.production_change_records;
CREATE TRIGGER production_changes_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.production_change_records FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS dependency_edges_runtime_write ON agm_governance.governance_dependency_edges;
CREATE TRIGGER dependency_edges_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.governance_dependency_edges FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS versions_runtime_write ON agm_governance.version_records;
CREATE TRIGGER versions_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.version_records FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS snapshots_runtime_write ON agm_governance.snapshot_records;
CREATE TRIGGER snapshots_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.snapshot_records FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS incidents_runtime_write ON agm_governance.incident_forensic_records;
CREATE TRIGGER incidents_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.incident_forensic_records FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS break_glass_runtime_write ON agm_governance.break_glass_authorizations;
CREATE TRIGGER break_glass_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.break_glass_authorizations FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS risk_knowledge_runtime_write ON agm_governance.risk_knowledge_assessments;
CREATE TRIGGER risk_knowledge_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.risk_knowledge_assessments FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS snapshots_integrity_gate ON agm_governance.snapshot_records;
CREATE TRIGGER snapshots_integrity_gate BEFORE INSERT OR UPDATE ON agm_governance.snapshot_records FOR EACH ROW EXECUTE FUNCTION agm_governance.require_snapshot_integrity();

DROP TRIGGER IF EXISTS actor_principals_runtime_write ON agm_governance.actor_principals;
CREATE TRIGGER actor_principals_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.actor_principals FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS proposals_runtime_write ON agm_governance.proposals;
CREATE TRIGGER proposals_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.proposals FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
CREATE OR REPLACE FUNCTION agm_governance.reject_proposal_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PROPOSAL_HISTORY_PROTECTED'; END;
$$;
DROP TRIGGER IF EXISTS proposals_no_delete ON agm_governance.proposals;
CREATE TRIGGER proposals_no_delete BEFORE DELETE ON agm_governance.proposals FOR EACH ROW EXECUTE FUNCTION agm_governance.reject_proposal_delete();
DROP TRIGGER IF EXISTS recovery_evidence_runtime_write ON agm_governance.recovery_evidence;
CREATE TRIGGER recovery_evidence_runtime_write BEFORE INSERT OR UPDATE OR DELETE ON agm_governance.recovery_evidence FOR EACH ROW EXECUTE FUNCTION agm_governance.require_runtime_write();
DROP TRIGGER IF EXISTS recovery_evidence_no_delete ON agm_governance.recovery_evidence;
CREATE TRIGGER recovery_evidence_no_delete BEFORE DELETE ON agm_governance.recovery_evidence FOR EACH ROW EXECUTE FUNCTION agm_governance.reject_event_mutation();
