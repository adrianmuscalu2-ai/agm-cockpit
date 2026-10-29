import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { BreakGlassAuthorization, CanonicalSourceChange, CanonicalSourceRecord, GovernanceDependencyEdge, GovernanceActorPrincipal, GovernanceProposal, IncidentRecord, ProductionChangeRecord, RecoveryEvidenceRecord, RiskKnowledgeAssessment, SnapshotRecord, VersionRecord } from './governance-v2.contract';
import { MACHINE_CANDIDATE_BINDING } from './governance-v2.contract';

type SqlClient = { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T[]>; $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number> };
const table = 'agm_governance';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stamp = () => new Date().toISOString();

/** Minimal persistence boundary for Governance V2. The caller owns the transaction. */
export class GovernanceV2Persistence {
  constructor(private readonly db: SqlClient) {}

  async transaction<T>(work: (db: SqlClient) => Promise<T>) {
    await this.db.$executeRawUnsafe('BEGIN');
    try { await this.db.$executeRawUnsafe(`SELECT set_config('agm.governance_context','approved',true)`); const result = await work(this.db); await this.db.$executeRawUnsafe('COMMIT'); return result; }
    catch (error) { await this.db.$executeRawUnsafe('ROLLBACK'); throw error; }
  }

  async activeSource(factKey: string) {
    const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.canonical_source_records WHERE fact_key = $1 AND status = 'ACTIVE'`, factKey);
    return rows[0] ?? null;
  }

  async listCanonicalSources(factKey?: string) {
    return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.canonical_source_records ${factKey ? 'WHERE fact_key = $1' : ''} ORDER BY created_at, id`, ...(factKey ? [factKey] : []));
  }

  async createCanonicalSource(input: Omit<CanonicalSourceRecord, 'createdAt' | 'updatedAt' | 'status'> & { status?: CanonicalSourceRecord['status'] }) {
    const status = input.status ?? 'DRAFT';
    if (status === 'ACTIVE' && await this.activeSource(input.factKey)) throw new Error('CANONICAL_SOURCE_COLLISION');
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.canonical_source_records (id,fact_key,human_title,description,canonical_source,write_authority,validator_authority,readers,precedence,conflict_behavior,contract_version,status,activated_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::timestamptz,$13::timestamptz,$13::timestamptz)`, input.id, input.factKey, input.humanTitle, input.description, input.canonicalSource, input.writeAuthority, input.validatorAuthority, JSON.stringify(input.readers), input.precedence, input.conflictBehavior, input.contractVersion, status, input.activatedAt);
    await this.recordEvent('CREATED', 'CanonicalSourceRecord', input.id, input.writeAuthority, input, []);
    return this.readCanonicalSource(input.id);
  }

  async readCanonicalSource(id: string) {
    const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.canonical_source_records WHERE id = $1`, id);
    return rows[0] ?? null;
  }

  async requestCanonicalSourceChange(input: Omit<CanonicalSourceChange, 'status' | 'approvalStatus' | 'validationEvidence'>) {
    const current = await this.activeSource(input.factKey) as { canonical_source: string; write_authority: string; precedence: number } | null;
    if (!current || current.canonical_source !== input.oldSource || current.write_authority !== input.oldWriteAuthority || current.precedence !== input.oldPrecedence) throw new Error('OLD_SOURCE_MISMATCH');
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.canonical_source_changes (id,semantic_title,fact_key,old_source,new_source,old_write_authority,new_write_authority,old_precedence,new_precedence,reason,impact_study_ref,migration_plan_ref,test_plan_ref,rollback_plan_ref,approval_status,status,proposer_id,proposal_id,pcr_id,candidate_digest,correlation_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PENDING','DRAFT',$15,$16,$17,$18,$19)`, input.id, input.semanticTitle, input.factKey, input.oldSource, input.newSource, input.oldWriteAuthority, input.newWriteAuthority, input.oldPrecedence, input.newPrecedence, input.reason, input.impactStudyRef, input.migrationPlanRef, input.testPlanRef, input.rollbackPlanRef, input.proposerId, input.proposalId ?? null, input.pcrId ?? null, input.candidateDigest ?? null, input.correlationId ?? null);
    await this.recordEvent('CREATED', 'CanonicalSourceChange', input.id, input.proposerId, input, []);
    return this.readCsc(input.id);
  }

  async readCsc(id: string) { const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.canonical_source_changes WHERE id = $1`, id); return rows[0] ?? null; }

  async transitionCsc(id: string, transition: 'IMPACT_ASSESSED' | 'APPROVED' | 'VALIDATED' | 'ACTIVATED', actorId: string, evidence: string[] = [], version?: string) {
    const csc = await this.readCsc(id) as Record<string, unknown> | null;
    if (!csc) throw new Error('CSC_NOT_FOUND');
    if (transition === 'IMPACT_ASSESSED') {
      if (!csc.impact_study_ref || !csc.migration_plan_ref || !csc.test_plan_ref || !csc.rollback_plan_ref) throw new Error('IMPACT_STUDY_INCOMPLETE');
      await this.db.$executeRawUnsafe(`UPDATE ${table}.canonical_source_changes SET status='IMPACT_ASSESSED' WHERE id=$1`, id);
    } else if (transition === 'APPROVED') {
      if (csc.proposer_id === actorId || !['DRAFT', 'IMPACT_ASSESSED'].includes(String(csc.status))) throw new Error('APPROVAL_DENIED');
      await this.db.$executeRawUnsafe(`UPDATE ${table}.canonical_source_changes SET status='APPROVED',approval_status='APPROVED',approved_by=$2 WHERE id=$1`, id, actorId);
    } else if (transition === 'VALIDATED') {
      if (csc.proposer_id === actorId || csc.approval_status !== 'APPROVED' || !evidence.length) throw new Error('CSC_VALIDATION_INCOMPLETE');
      await this.db.$executeRawUnsafe(`UPDATE ${table}.canonical_source_changes SET status='VALIDATED',validation_evidence=$2::jsonb,validator_id=$3 WHERE id=$1`, id, JSON.stringify(evidence), actorId);
    } else {
      if (csc.status !== 'VALIDATED' || csc.approved_by === actorId || !csc.validator_id || !version) throw new Error('CSC_NOT_APPROVED_AND_VALIDATED');
      const current = await this.activeSource(String(csc.fact_key)) as Record<string, unknown> | null;
      if (!current || current.canonical_source !== csc.old_source) throw new Error('SOURCE_CHANGED_WITHOUT_CSC');
      const at = stamp();
      await this.db.$executeRawUnsafe(`UPDATE ${table}.canonical_source_records SET status='SUPERSEDED',superseded_at=$2::timestamptz,superseded_by=$3,updated_at=$2::timestamptz WHERE id=$1`, current.id, at, csc.new_source);
      await this.db.$executeRawUnsafe(`INSERT INTO ${table}.canonical_source_records (id,fact_key,human_title,description,canonical_source,write_authority,validator_authority,readers,precedence,conflict_behavior,contract_version,status,activated_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,'ACTIVE',$12::timestamptz,$12::timestamptz,$12::timestamptz)`, `${id}:new`, csc.fact_key, csc.semantic_title, `Activated by ${id}`, csc.new_source, csc.new_write_authority, csc.validator_id, JSON.stringify(current.readers), csc.new_precedence, current.conflict_behavior, version, at);
      await this.db.$executeRawUnsafe(`UPDATE ${table}.canonical_source_changes SET status='ACTIVATED',activated_version=$2,activated_at=$3::timestamptz WHERE id=$1`, id, version, at);
    }
    await this.recordEvent(transition === 'ACTIVATED' ? 'ACTIVATED' : transition === 'APPROVED' ? 'APPROVED' : 'VALIDATED', 'CanonicalSourceChange', id, actorId, { transition, evidence, version }, evidence);
    return this.readCsc(id);
  }

  async registerGovernanceActor(input: GovernanceActorPrincipal) {
    if (!input.id.trim() || !input.displayName.trim() || !input.roles.length) throw new Error('ACTOR_IDENTITY_INCOMPLETE');
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.actor_principals (actor_id,display_name,roles,can_propose,can_validate,can_execute,status) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7) ON CONFLICT (actor_id) DO UPDATE SET display_name=EXCLUDED.display_name,roles=EXCLUDED.roles,can_propose=EXCLUDED.can_propose,can_validate=EXCLUDED.can_validate,can_execute=EXCLUDED.can_execute,status=EXCLUDED.status,updated_at=now()`, input.id, input.displayName, JSON.stringify(input.roles), input.canPropose, input.canValidate, input.canExecute, input.status);
    await this.recordEvent('ACTOR_REGISTERED', 'GovernanceActorPrincipal', input.id, input.id, input, []);
    return this.readGovernanceActor(input.id);
  }

  async readGovernanceActor(id: string) { const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.actor_principals WHERE actor_id=$1`, id); return rows[0] ?? null; }
  async listGovernanceActors() { return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.actor_principals ORDER BY actor_id`); }

  private async requireActor(id: string, capability: 'propose' | 'validate') {
    const actor = await this.readGovernanceActor(id) as Record<string, unknown> | null;
    if (!actor || actor.status !== 'ACTIVE' || (capability === 'propose' ? actor.can_propose !== true : actor.can_validate !== true)) throw new Error('GOVERNANCE_ACTOR_UNAUTHORIZED');
    return actor;
  }

  private async requireActiveActor(id: string) {
    const actor = await this.readGovernanceActor(id) as Record<string, unknown> | null;
    if (!actor || actor.status !== 'ACTIVE') throw new Error('GOVERNANCE_ACTOR_UNAUTHORIZED');
    return actor;
  }

  async createProposal(input: GovernanceProposal) {
    if (!input.proposalId || input.status !== 'DRAFT' || !input.candidateRef || !input.candidateDigest) throw new Error('PROPOSAL_CONTRACT_INCOMPLETE');
    if (input.candidateRef === MACHINE_CANDIDATE_BINDING.candidateRef && input.candidateDigest !== MACHINE_CANDIDATE_BINDING.candidateDigest) throw new Error('CANDIDATE_DIGEST_MISMATCH');
    await this.requireActor(input.proposerId, 'propose');
    if (input.importerId) await this.requireActor(input.importerId, 'validate');
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.proposals (proposal_id,semantic_title,description,scope,proposal_type,proposer_id,created_at,updated_at,candidate_ref,candidate_digest,base_revision,affected_components,affected_facts,correlation_id,status,evidence_refs,risk_assessment_refs,impact_study_ref,dependency_graph_ref,snapshot_ref,version_ref,pcr_refs,csc_refs,historical_evidence_at,reconciled_at,importer_id) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16::jsonb,$17::jsonb,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24::timestamptz,$25::timestamptz,$26)`, input.proposalId,input.semanticTitle,input.description,input.scope,input.proposalType,input.proposerId,input.createdAt,input.updatedAt,input.candidateRef,input.candidateDigest,input.baseRevision,JSON.stringify(input.affectedComponents),JSON.stringify(input.affectedFacts),input.correlationId,input.status,JSON.stringify(input.evidenceRefs),JSON.stringify(input.riskAssessmentRefs),input.impactStudyRef,input.dependencyGraphRef,input.snapshotRef,input.versionRef??null,JSON.stringify(input.pcrRefs),JSON.stringify(input.cscRefs),input.historicalEvidenceAt??null,input.reconciledAt??null,input.importerId??null);
    await this.recordEvent('PROPOSAL_CREATED', 'GovernanceProposal', input.proposalId, input.proposerId, input, input.evidenceRefs);
    return this.readProposal(input.proposalId);
  }

  async readProposal(id: string) { const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.proposals WHERE proposal_id=$1`, id); return rows[0] ?? null; }
  async listProposals() { return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.proposals ORDER BY created_at,proposal_id`); }
  async searchProposals(query: string) { return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.proposals WHERE to_tsvector('simple', semantic_title || ' ' || description || ' ' || scope || ' ' || proposal_type || ' ' || candidate_ref || ' ' || candidate_digest) @@ plainto_tsquery('simple',$1) ORDER BY created_at,proposal_id`, query); }

  async transitionProposal(id: string, target: GovernanceProposal['status'], actorId: string, evidenceRefs: string[] = []) {
    const proposal = await this.readProposal(id) as Record<string, unknown> | null;
    if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
    const current = String(proposal.status);
    const allowed: Record<string, string[]> = { DRAFT: ['REVIEWED','REJECTED','ABANDONED'], REVIEWED: ['ACCEPTED_FOR_CHANGE_CONTROL','REJECTED','ABANDONED'], ACCEPTED_FOR_CHANGE_CONTROL: ['SUPERSEDED','REJECTED','ABANDONED'] };
    if (!allowed[current]?.includes(target)) throw new Error('PROPOSAL_INVALID_TRANSITION');
    if (target === 'REVIEWED' || target === 'ACCEPTED_FOR_CHANGE_CONTROL') { await this.requireActor(actorId, 'validate'); if (String(proposal.proposer_id) === actorId) throw new Error('PROPOSAL_SELF_APPROVAL_DENIED'); }
    else await this.requireActor(actorId, 'validate');
    await this.db.$executeRawUnsafe(`UPDATE ${table}.proposals SET status=$2,updated_at=now(),evidence_refs=evidence_refs || $3::jsonb WHERE proposal_id=$1`, id,target,JSON.stringify(evidenceRefs));
    await this.recordEvent(target === 'REVIEWED' ? 'PROPOSAL_REVIEWED' : 'PROPOSAL_STATUS_CHANGED', 'GovernanceProposal', id, actorId, { from: current, to: target }, evidenceRefs);
    return this.readProposal(id);
  }

  async reconcileHistoricalProposal(input: GovernanceProposal, importerId: string, historicalEvidenceAt: string) {
    if (!historicalEvidenceAt || !input.evidenceRefs.length) throw new Error('HISTORICAL_PROVENANCE_INCOMPLETE');
    return this.createProposal({ ...input, status: 'DRAFT', importerId, historicalEvidenceAt, reconciledAt: stamp(), createdAt: stamp(), updatedAt: stamp() });
  }

  private async validateRecoveryBinding(input: RecoveryEvidenceRecord) {
    if (!input.recoveryEvidenceId || !input.candidateRef || !input.candidateDigest || !input.versionId || !input.pcrId || !input.snapshotRef) throw new Error('RECOVERY_EVIDENCE_CONTRACT_INCOMPLETE');
    if (input.candidateRef === MACHINE_CANDIDATE_BINDING.candidateRef && input.candidateDigest !== MACHINE_CANDIDATE_BINDING.candidateDigest) throw new Error('CANDIDATE_DIGEST_MISMATCH');
    const versions = await this.db.$queryRawUnsafe<Record<string, unknown>>(`SELECT id,candidate_digest FROM ${table}.version_records WHERE id=$1`, input.versionId);
    if (!versions[0]) throw new Error('RECOVERY_VERSION_NOT_FOUND');
    if (versions[0].candidate_digest && versions[0].candidate_digest !== input.candidateDigest) throw new Error('RECOVERY_VERSION_DIGEST_MISMATCH');
    const pcrs = await this.db.$queryRawUnsafe<Record<string, unknown>>(`SELECT id,candidate_digest FROM ${table}.production_change_records WHERE id=$1`, input.pcrId);
    if (!pcrs[0]) throw new Error('RECOVERY_PCR_NOT_FOUND');
    if (pcrs[0].candidate_digest && pcrs[0].candidate_digest !== input.candidateDigest) throw new Error('RECOVERY_PCR_DIGEST_MISMATCH');
    await this.requireActiveActor(input.executorId);
    if (input.validatorId) await this.requireActiveActor(input.validatorId);
    if (input.verdict === 'PASS' && (!input.completedAt || !input.validatorId || input.executorId === input.validatorId)) throw new Error('RECOVERY_PASS_VALIDATION_INCOMPLETE');
    if (input.backupSha256 && !/^[a-f0-9]{64}$/i.test(input.backupSha256)) throw new Error('RECOVERY_BACKUP_DIGEST_INVALID');
    if (input.recoveryType === 'BACKUP_RESTORE' && input.verdict === 'PASS' && (!input.backupRef || !input.backupSha256 || input.destroyVerified !== true || input.restoreVerified !== true || input.postRestoreStartupVerified !== true || !input.criticalTestsResult || input.criticalTestsResult !== 'PASS')) throw new Error('RECOVERY_BACKUP_RESTORE_EVIDENCE_INCOMPLETE');
    if (input.recoveryType === 'RESTART' && input.verdict === 'PASS' && (input.environmentClass === 'PRODUCTION' || !input.readinessResult || input.readinessResult !== 'PASS' || !input.evidenceRefs.length)) throw new Error('RECOVERY_RESTART_EVIDENCE_INCOMPLETE');
    if (input.recoveryType === 'ROLLBACK_DRILL' && input.verdict === 'PASS' && (!input.rollbackPlanRef || !input.evidenceRefs.length)) throw new Error('RECOVERY_ROLLBACK_EVIDENCE_INCOMPLETE');
    if (input.verdict === 'PASS' && input.environmentClass === 'PRODUCTION') throw new Error('PRODUCTION_RECOVERY_FORBIDDEN');
  }

  async createRecoveryEvidence(input: RecoveryEvidenceRecord) {
    await this.validateRecoveryBinding(input);
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.recovery_evidence (recovery_evidence_id,recovery_type,candidate_ref,candidate_digest,version_id,proposal_id,pcr_id,snapshot_ref,environment_class,started_at,completed_at,executor_id,validator_id,correlation_id,backup_ref,backup_sha256,source_db_ref,source_environment_ref,restore_target_ref,destroy_verified,restore_verified,post_restore_startup_verified,readiness_result,critical_tests_result,rollback_plan_ref,evidence_refs,contract_version,verdict,notes,reason_code,historical_execution_at,reconciled_at,importer_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27,$28,$29,$30,$31::timestamptz,$32::timestamptz,$33)`, input.recoveryEvidenceId,input.recoveryType,input.candidateRef,input.candidateDigest,input.versionId,input.proposalId??null,input.pcrId,input.snapshotRef,input.environmentClass,input.startedAt,input.completedAt??null,input.executorId,input.validatorId??null,input.correlationId,input.backupRef??null,input.backupSha256??null,input.sourceDbRef??null,input.sourceEnvironmentRef??null,input.restoreTargetRef??null,input.destroyVerified??null,input.restoreVerified??null,input.postRestoreStartupVerified??null,input.readinessResult??null,input.criticalTestsResult??null,input.rollbackPlanRef,JSON.stringify(input.evidenceRefs),input.contractVersion,input.verdict,input.notes??null,input.reasonCode??null,input.historicalExecutionAt??null,input.reconciledAt??null,input.importerId??null);
    await this.recordEvent('RECOVERY_EVIDENCE_CREATED', 'RecoveryEvidence', input.recoveryEvidenceId, input.executorId, input, input.evidenceRefs);
    return this.readRecoveryEvidence(input.recoveryEvidenceId);
  }

  async readRecoveryEvidence(id: string) { const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.recovery_evidence WHERE recovery_evidence_id=$1`, id); return rows[0] ?? null; }
  async listRecoveryEvidence(candidateDigest?: string) { return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.recovery_evidence ${candidateDigest ? 'WHERE candidate_digest=$1' : ''} ORDER BY started_at,recovery_evidence_id`, ...(candidateDigest ? [candidateDigest] : [])); }
  async searchRecoveryEvidence(query: string) { return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.recovery_evidence WHERE to_tsvector('simple', candidate_ref || ' ' || recovery_type || ' ' || COALESCE(notes,'') || ' ' || COALESCE(reason_code,'')) @@ plainto_tsquery('simple',$1) ORDER BY started_at,recovery_evidence_id`, query); }

  async reconcileHistoricalRecoveryEvidence(input: RecoveryEvidenceRecord, importerId: string, historicalExecutionAt: string) {
    if (!historicalExecutionAt || !input.evidenceRefs.length || (input.recoveryType === 'BACKUP_RESTORE' && !input.backupSha256)) throw new Error('RECOVERY_HISTORICAL_PROVENANCE_INCOMPLETE');
    await this.requireActiveActor(importerId);
    const reconciledAt = stamp();
    await this.createRecoveryEvidence({ ...input, historicalExecutionAt, reconciledAt, importerId });
    await this.recordEvent('RECOVERY_EVIDENCE_RECONCILED', 'RecoveryEvidence', input.recoveryEvidenceId, importerId, { historicalExecutionAt, reconciledAt, importerId }, input.evidenceRefs);
    return this.readRecoveryEvidence(input.recoveryEvidenceId);
  }

  async addDependencyEdge(edge: GovernanceDependencyEdge) {
    const duplicate = await this.db.$queryRawUnsafe(`SELECT id FROM ${table}.governance_dependency_edges WHERE source_component=$1 AND relation=$2 AND target_component=$3 AND superseded_at IS NULL`, edge.sourceComponent, edge.relation, edge.targetComponent);
    if (duplicate.length) throw new Error('DUPLICATE_ACTIVE_DEPENDENCY');
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.governance_dependency_edges (id,source_component,relation,target_component,criticality,validation_required,introduced_at) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)`, edge.id, edge.sourceComponent, edge.relation, edge.targetComponent, edge.criticality, edge.validationRequired, edge.introducedAt);
    await this.recordEvent('CREATED', 'GovernanceDependencyEdge', edge.id, 'governance-runtime', edge, []);
    return edge;
  }

  async createProductionChange(input: Omit<ProductionChangeRecord, 'status' | 'approvalStatus' | 'dependencyChecks'>) {
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.production_change_records (id,semantic_title,description,impact_class,affected_components,affected_canonical_sources,dependency_impact_ref,impact_study,test_plan,rollback_plan,snapshot_ref,candidate_ref,candidate_digest,approval_status,related_incidents,related_csc,proposer_id,schema_change,migration_ref,migration_risk,backward_compatibility_impact,proposal_id,status) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,'PENDING',$14::jsonb,$15::jsonb,$16,$17,$18,$19,$20,$21,'DRAFT')`, input.id, input.semanticTitle, input.description, input.impactClass, JSON.stringify(input.affectedComponents), JSON.stringify(input.affectedCanonicalSources), input.dependencyImpactRef, input.impactStudy, input.testPlan, input.rollbackPlan, input.snapshotRef, input.candidateRef, input.candidateDigest ?? null, JSON.stringify(input.relatedIncidents), JSON.stringify(input.relatedCSC), input.proposerId, input.schemaChange ?? false, input.migrationRef ?? null, input.migrationRisk ?? null, input.backwardCompatibilityImpact ?? null, input.proposalId ?? null);
    await this.recordEvent('CREATED', 'ProductionChangeRecord', input.id, input.proposerId, input, []);
    return this.readPcr(input.id);
  }

  async readPcr(id: string) { const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.production_change_records WHERE id=$1`, id); return rows[0] ?? null; }

  async assessProductionChange(id: string, actorId: string) {
    const pcr = await this.readPcr(id) as Record<string, unknown> | null; if (!pcr) throw new Error('PCR_NOT_FOUND');
    if (!pcr.impact_study || !pcr.dependency_impact_ref || !pcr.snapshot_ref || !pcr.test_plan || !pcr.rollback_plan) throw new Error('IMPACT_STUDY_INCOMPLETE');
    await this.db.$executeRawUnsafe(`UPDATE ${table}.production_change_records SET status='IMPACT_ASSESSED' WHERE id=$1`, id); await this.recordEvent('VALIDATED','ProductionChangeRecord',id,actorId,{transition:'IMPACT_ASSESSED'},[String(pcr.impact_study)]); return this.readPcr(id);
  }

  async recordDependencyResult(id: string, component: string, result: string) { await this.db.$executeRawUnsafe(`UPDATE ${table}.production_change_records SET dependency_checks=dependency_checks || jsonb_build_object($2,$3) WHERE id=$1`, id, component, result); return this.readPcr(id); }
  async recordDependencyGraphStatus(id: string, status: 'COMPLETE' | 'INCOMPLETE' | 'UNKNOWN', evidenceRef: string) { await this.db.$executeRawUnsafe(`UPDATE ${table}.production_change_records SET dependency_checks=dependency_checks || jsonb_build_object('__graph',jsonb_build_object('status',$2,'evidenceRef',$3)) WHERE id=$1`, id, status, evidenceRef); return this.readPcr(id); }
  async recordAcceptedDegradation(id: string, component: string, humanApprovalId: string, rationale: string, evidenceRef: string, expiry?: string) { await this.db.$executeRawUnsafe(`UPDATE ${table}.production_change_records SET dependency_checks=dependency_checks || jsonb_build_object($2,jsonb_build_object('status','EXPLICIT_ACCEPTED_DEGRADATION','humanApprovalId',$3,'rationale',$4,'evidenceRef',$5,'expiry',$6::text)) WHERE id=$1`, id, component, humanApprovalId, rationale, evidenceRef, expiry ?? null); return this.readPcr(id); }

  async approveProductionChange(id: string, actorId: string) {
    const pcr = await this.readPcr(id) as Record<string, unknown> | null; if (!pcr) throw new Error('PCR_NOT_FOUND'); if (pcr.proposer_id === actorId) throw new Error('APPROVER_CANNOT_BE_PROPOSER');
    if (pcr.impact_class === 'STRUCTURAL') {
      const cscRefs = (pcr.related_csc as string[]) ?? [];
      if (!cscRefs.length) throw new Error('STRUCTURAL_CSC_REQUIRED');
      const cscRows = await this.db.$queryRawUnsafe<{ status: string }>(`SELECT status FROM ${table}.canonical_source_changes WHERE id = ANY($1::text[])`, cscRefs);
      if (cscRows.length !== cscRefs.length || cscRows.some((row) => row.status !== 'ACTIVATED')) throw new Error('STRUCTURAL_CSC_NOT_ACTIVATED');
    }
    const affected = (pcr.affected_components as string[]) ?? []; const impacted = await this.impactedComponents(String(affected[0] ?? '')); const checks = (pcr.dependency_checks as Record<string, unknown> | null) ?? {};
    const graph = checks.__graph as { status?: string } | undefined;
    if (graph?.status !== 'COMPLETE') throw new Error('DEPENDENCY_GRAPH_INCOMPLETE');
    const blocked = impacted.some(component => { const value = checks[component]; if (value === 'PASS') return false; if (!value || typeof value === 'string') return true; const accepted = value as Record<string, unknown>; return accepted.status !== 'EXPLICIT_ACCEPTED_DEGRADATION' || !accepted.humanApprovalId || !accepted.rationale || !accepted.evidenceRef; }); if (blocked) throw new Error('REGRESSION_CASCADE_BLOCKED');
    await this.db.$executeRawUnsafe(`UPDATE ${table}.production_change_records SET status='APPROVED',approval_status='APPROVED',approver_id=$2 WHERE id=$1`, id, actorId); await this.recordEvent('APPROVED','ProductionChangeRecord',id,actorId,{transition:'APPROVED',impacted},[]); return this.readPcr(id);
  }

  async evaluateProductionReleaseGate(id: string, actorId: string, binding?: { candidateRef: string; versionId: string; revision: string; artifactDigest?: string }) {
    const pcr = await this.readPcr(id) as Record<string, unknown> | null;
    if (!pcr) throw new Error('RELEASE_BLOCKED:PCR_NOT_FOUND');
    if (!binding?.candidateRef || !binding.versionId || !binding.revision) throw new Error('RELEASE_BLOCKED:BINDING_INPUT_INCOMPLETE');
    if (String(pcr.candidate_ref) !== binding.candidateRef) throw new Error('RELEASE_BLOCKED:CANDIDATE_MISMATCH');
    const versions = await this.db.$queryRawUnsafe<{ commit_sha: string; candidate_snapshot: string; artifact_digests: unknown }>(`SELECT commit_sha,candidate_snapshot,artifact_digests FROM ${table}.version_records WHERE id=$1`, binding.versionId);
    if (versions.length !== 1 || versions[0].commit_sha !== binding.revision || versions[0].candidate_snapshot !== String(pcr.snapshot_ref)) throw new Error('RELEASE_BLOCKED:REVISION_MISMATCH');
    if (pcr.schema_change && (!pcr.migration_ref || !pcr.migration_risk || !pcr.backward_compatibility_impact)) throw new Error('RELEASE_BLOCKED:MIGRATION_BINDING_INCOMPLETE');
    if (binding.artifactDigest && !(Array.isArray(versions[0].artifact_digests) && versions[0].artifact_digests.includes(binding.artifactDigest))) throw new Error('RELEASE_BLOCKED:ARTIFACT_DIGEST_MISMATCH');
    const required = ['impact_study', 'dependency_impact_ref', 'snapshot_ref', 'candidate_ref', 'test_plan', 'rollback_plan'];
    if (required.some((field) => !pcr[field])) throw new Error('RELEASE_BLOCKED:IMPACT_STUDY_INCOMPLETE');
    if (pcr.status !== 'APPROVED' || pcr.approval_status !== 'APPROVED') throw new Error('RELEASE_BLOCKED:PCR_NOT_APPROVED');
    if (!pcr.approver_id || pcr.approver_id === pcr.proposer_id || pcr.approver_id === actorId) throw new Error('RELEASE_BLOCKED:ACTOR_SEPARATION');
    if (pcr.impact_class === 'STRUCTURAL') {
      const refs = (pcr.related_csc as string[]) ?? [];
      if (!refs.length) throw new Error('RELEASE_BLOCKED:CSC_REQUIRED');
      const rows = await this.db.$queryRawUnsafe<{ status: string }>(`SELECT status FROM ${table}.canonical_source_changes WHERE id = ANY($1::text[])`, refs);
      if (rows.length !== refs.length || rows.some((row) => row.status !== 'ACTIVATED')) throw new Error('RELEASE_BLOCKED:CSC_NOT_ACTIVATED');
    }
    const affected = (pcr.affected_components as string[]) ?? [];
    const checks = (pcr.dependency_checks as Record<string, unknown> | null) ?? {};
    const graph = checks.__graph as { status?: string } | undefined;
    if (graph?.status !== 'COMPLETE') throw new Error('RELEASE_BLOCKED:DEPENDENCY_GRAPH_INCOMPLETE');
    const impacted = await this.impactedComponents(String(affected[0] ?? ''));
    const blocked = impacted.some((component) => {
      const value = checks[component];
      if (value === 'PASS') return false;
      if (!value || typeof value === 'string') return true;
      const accepted = value as Record<string, unknown>;
      return accepted.status !== 'EXPLICIT_ACCEPTED_DEGRADATION' || !accepted.humanApprovalId || !accepted.rationale || !accepted.evidenceRef;
    });
    if (blocked) throw new Error('RELEASE_BLOCKED:REGRESSION_CASCADE');
    return { status: 'READY_FOR_PRODUCTION_APPROVAL', productionMutation: false, pcrId: id, actorId, candidateRef: binding.candidateRef, versionId: binding.versionId, revision: binding.revision, snapshotRef: pcr.snapshot_ref, relatedCsc: pcr.related_csc ?? [], dependencyGraph: graph.status, impactedComponents: impacted, schemaChange: Boolean(pcr.schema_change), migrationRef: pcr.migration_ref ?? null };
  }

  async recordProductionExecution(id: string, actorId: string, revision: string) {
    const pcr = await this.readPcr(id) as Record<string, unknown> | null;
    if (!pcr || pcr.status !== 'APPROVED') throw new Error('PCR_NOT_APPROVED');
    if (pcr.proposer_id === actorId || pcr.approver_id === actorId) throw new Error('EXECUTOR_ACTOR_SEPARATION_DENIED');
    await this.db.$executeRawUnsafe(`UPDATE ${table}.production_change_records SET status='DEPLOYED',executor_id=$2,deploy_revision=$3 WHERE id=$1`, id, actorId, revision);
    await this.recordEvent('ACTIVATED', 'ProductionChangeRecord', id, actorId, { transition: 'EXECUTION_RECORDED', revision }, [revision]);
    return this.readPcr(id);
  }

  async validateProductionChange(id: string, actorId: string, evidence: string[], verdict: 'PASS' | 'FAIL') {
    const pcr = await this.readPcr(id) as Record<string, unknown> | null;
    if (!pcr || pcr.status !== 'DEPLOYED' || !evidence.length) throw new Error('POST_DEPLOY_VALIDATION_INCOMPLETE');
    if (pcr.proposer_id === actorId || pcr.executor_id === actorId) throw new Error('VALIDATOR_ACTOR_SEPARATION_DENIED');
    const status = verdict === 'PASS' ? 'CLOSED' : 'FAILED_VALIDATION';
    await this.db.$executeRawUnsafe(`UPDATE ${table}.production_change_records SET status=$2,validator_id=$3,post_deploy_verification=$4,final_verdict=$5 WHERE id=$1`, id, status, actorId, evidence.join(','), verdict);
    await this.recordEvent('CLOSES', 'ProductionChangeRecord', id, actorId, { transition: 'POST_DEPLOY_VALIDATED', verdict }, evidence);
    return this.readPcr(id);
  }

  async createVersion(version: VersionRecord) { await this.db.$executeRawUnsafe(`INSERT INTO ${table}.version_records (id,semantic_title,status,base_revision,commit_sha,candidate_digest,artifact_digests,candidate_snapshot,validation_evidence,pcr_refs,csc_refs,incident_refs,final_verdict) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13)`, version.id,version.semanticTitle,version.status,version.baseRevision,version.commitSha,version.candidateDigest ?? null,JSON.stringify(version.artifactDigests),version.candidateSnapshot,JSON.stringify(version.validationEvidence),JSON.stringify(version.pcrRefs),JSON.stringify(version.cscRefs),JSON.stringify(version.incidentRefs),version.finalVerdict ?? null); await this.recordEvent('CREATED','VersionRecord',version.id,'governance-runtime',version,[]); return version; }
  async readVersion(id: string) { const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.version_records WHERE id=$1`, id); return rows[0] ?? null; }

  async promoteVersion(id: string, target: VersionRecord['status']) { const rows=await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.version_records WHERE id=$1`,id); const v=rows[0] as Record<string,unknown>|undefined; if(!v)throw new Error('VERSION_NOT_FOUND'); const allowed:Record<string,string[]>={CANDIDATE:['WIP'],VALIDATED:['CANDIDATE'],CANONICAL:['VALIDATED'],DEPLOYED:['CANONICAL']}; if(allowed[target]&&!allowed[target].includes(String(v.status)))throw new Error('INVALID_VERSION_PROMOTION'); if(target==='DEPLOYED')throw new Error('PRODUCTION_DEPLOY_FORBIDDEN'); await this.db.$executeRawUnsafe(`UPDATE ${table}.version_records SET status=$2 WHERE id=$1`,id,target); await this.recordEvent('ACTIVATED','VersionRecord',id,'governance-runtime',{from:v.status,to:target},[]); return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.version_records WHERE id=$1`,id); }

  async createSnapshot(snapshot: SnapshotRecord) { await this.db.$executeRawUnsafe(`INSERT INTO ${table}.snapshot_records (snapshot_id,semantic_title,content_summary,tags,status,branch,base_commit,worktree,manifest_digest,snapshot_digest,changed_files,untracked_files,tests,related_version,related_incident,related_csc,related_pcr,created_at) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18::timestamptz)`,snapshot.snapshotId,snapshot.semanticTitle,snapshot.contentSummary,JSON.stringify(snapshot.tags),snapshot.status,snapshot.branch,snapshot.baseCommit,snapshot.worktree,snapshot.manifestDigest,snapshot.snapshotDigest,JSON.stringify(snapshot.changedFiles),JSON.stringify(snapshot.untrackedFiles),JSON.stringify(snapshot.tests),snapshot.relatedVersion??null,snapshot.relatedIncident??null,snapshot.relatedCSC??null,snapshot.relatedPCR??null,snapshot.createdAt); await this.recordEvent('CREATED','SnapshotRecord',snapshot.snapshotId,'governance-runtime',snapshot,[]); return snapshot; }
  async readSnapshot(id: string) { const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.snapshot_records WHERE snapshot_id=$1`, id); return rows[0] ?? null; }

  async createIncident(incident: IncidentRecord) { await this.db.$executeRawUnsafe(`INSERT INTO ${table}.incident_forensic_records (incident_id,semantic_title,symptom,reproduction,root_cause,root_cause_classification,attempted_fixes,applied_remediation,test_evidence,validator,human_validation,introduced_version,fixed_version,related_csc,related_pcr,prevention,similar_incidents,closure_evidence) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$17::jsonb,$18)`,incident.id,incident.semanticTitle,incident.symptom,incident.reproduction,incident.rootCause,incident.rootCauseClassification,JSON.stringify(incident.attemptedFixes),incident.appliedRemediation,JSON.stringify(incident.testEvidence),incident.validator,incident.humanValidation??null,incident.introducedVersion??null,incident.fixedVersion??null,JSON.stringify(incident.relatedCSC),JSON.stringify(incident.relatedPCR),incident.prevention,JSON.stringify(incident.similarIncidents),incident.closureEvidence??null); await this.recordEvent('CREATED','IncidentForensicRecord',incident.id,incident.validator,incident,[]); return incident; }

  async createBreakGlassAuthorization(input: BreakGlassAuthorization) {
    const now = new Date(); const start = new Date(input.startedAt); const expiry = new Date(input.expiresAt);
    if (!input.authorizedHumanId || input.authorizedHumanId === input.requesterId) throw new Error('BREAK_GLASS_AUTHORITY_INVALID');
    if (!input.incidentId || !input.reason || !input.scopeComponent || !input.scopeOperation || !input.backupRef || !input.snapshotRef || !input.rollbackPlan || !input.riskAcceptance) throw new Error('BREAK_GLASS_EVIDENCE_INCOMPLETE');
    if (Number.isNaN(start.valueOf()) || Number.isNaN(expiry.valueOf()) || expiry <= start || expiry <= now) throw new Error('BREAK_GLASS_EXPIRY_INVALID');
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.break_glass_authorizations (id,authorized_human_id,authority_role,requester_id,incident_id,reason,scope_component,scope_operation,release_version,commit_sha,started_at,expires_at,backup_ref,snapshot_ref,rollback_plan,expected_impact,risk_acceptance,correlation_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13,$14,$15,$16,$17,$18,'AUTHORIZED')`, input.id,input.authorizedHumanId,input.authorityRole,input.requesterId,input.incidentId,input.reason,input.scopeComponent,input.scopeOperation,input.releaseVersion,input.commitSha,input.startedAt,input.expiresAt,input.backupRef,input.snapshotRef,input.rollbackPlan,input.expectedImpact,input.riskAcceptance,input.correlationId);
    await this.recordEvent('BREAK_GLASS_AUTHORIZED','BreakGlassAuthorization',input.id,input.authorizedHumanId,input,[input.backupRef,input.snapshotRef,input.incidentId]); return this.readBreakGlass(input.id);
  }
  async readBreakGlass(id: string) { const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.break_glass_authorizations WHERE id=$1`,id); return rows[0] ?? null; }
  async validateBreakGlassForExecution(id: string, executorId: string, at = stamp()) { const row = await this.readBreakGlass(id) as Record<string,unknown>|null; if(!row)throw new Error('BREAK_GLASS_NOT_FOUND'); if(row.status!=='AUTHORIZED')throw new Error('BREAK_GLASS_NOT_AUTHORIZED'); if(new Date(String(row.expires_at))<=new Date(at))throw new Error('BREAK_GLASS_EXPIRED'); if(row.requester_id===executorId)throw new Error('BREAK_GLASS_ACTOR_SEPARATION'); return {status:'EMERGENCY_ACTION_AUTHORIZED',authorizationId:id,scopeComponent:row.scope_component,scopeOperation:row.scope_operation,releaseVersion:row.release_version,commitSha:row.commit_sha,expiresAt:row.expires_at,productionMutation:false}; }
  async recordBreakGlassExecuted(id: string, executorId: string) { const auth=await this.validateBreakGlassForExecution(id,executorId); await this.db.$executeRawUnsafe(`UPDATE ${table}.break_glass_authorizations SET status='EXECUTED',executor_id=$2,updated_at=now() WHERE id=$1`,id,executorId); await this.recordEvent('BREAK_GLASS_EXECUTED','BreakGlassAuthorization',id,executorId,auth,[]); return this.readBreakGlass(id); }
  async recordBreakGlassValidation(id: string, validatorId: string, evidence: string[], verdict: 'VALIDATED'|'FAILED') { const row=await this.readBreakGlass(id) as Record<string,unknown>|null;if(!row||row.status!=='EXECUTED'||row.executor_id===validatorId||!evidence.length)throw new Error('BREAK_GLASS_VALIDATION_INVALID');const status=verdict==='VALIDATED'?'VALIDATED':'FAILED';await this.db.$executeRawUnsafe(`UPDATE ${table}.break_glass_authorizations SET status=$2,validator_id=$3,validation_evidence=$4::jsonb,updated_at=now() WHERE id=$1`,id,status,validatorId,JSON.stringify(evidence));await this.recordEvent(verdict==='VALIDATED'?'BREAK_GLASS_VALIDATED':'BREAK_GLASS_FAILED','BreakGlassAuthorization',id,validatorId,{verdict},evidence);return this.readBreakGlass(id); }

  private async recordEvent(eventType: string, entityType: string, entityId: string, actorId: string, payload: unknown, evidenceRefs: string[]) { const previous = await this.db.$queryRawUnsafe<{event_id:string,event_digest:string}>(`SELECT event_id,event_digest FROM ${table}.governance_events ORDER BY recorded_at DESC,event_id DESC LIMIT 1`); return this.appendEvent({eventId:randomUUID(),eventType,semanticTitle:`${eventType} ${entityType}`,entityType,entityId,previousEventId:previous[0]?.event_id,previousDigest:previous[0]?.event_digest,payload,correlationId:randomUUID(),actorId,occurredAt:stamp(),evidenceRefs}); }

  async searchSnapshots(query: string) {
    return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.snapshot_records WHERE to_tsvector('simple', semantic_title || ' ' || content_summary) @@ plainto_tsquery('simple', $1) ORDER BY snapshot_id`, query);
  }
  async searchBreakGlass(query: string) { return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.break_glass_authorizations WHERE to_tsvector('simple', reason || ' ' || incident_id || ' ' || scope_component || ' ' || scope_operation) @@ plainto_tsquery('simple',$1) ORDER BY created_at,id`,query); }

  async impactedComponents(sourceComponent: string) {
    const rows = await this.db.$queryRawUnsafe<{ component: string }>(`WITH RECURSIVE impact(component) AS (
      SELECT $1::text
      UNION
      SELECT e.target_component FROM ${table}.governance_dependency_edges e JOIN impact i ON e.source_component = i.component WHERE e.validation_required = true AND e.superseded_at IS NULL
    ) SELECT component FROM impact ORDER BY component`, sourceComponent);
    return rows.map((row) => row.component);
  }

  async searchWorktrees(query: string) {
    return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.worktree_records WHERE to_tsvector('simple', semantic_title || ' ' || description || ' ' || purpose_phase) @@ plainto_tsquery('simple', $1) ORDER BY worktree_id`, query);
  }

  async searchRiskKnowledge(query: string) {
    const [incidents, versions, snapshots, sources, cscs, pcrs, worktrees] = await Promise.all([
      this.db.$queryRawUnsafe(`SELECT * FROM ${table}.incident_forensic_records WHERE to_tsvector('simple', semantic_title || ' ' || symptom || ' ' || root_cause || ' ' || applied_remediation) @@ plainto_tsquery('simple',$1) ORDER BY incident_id`, query),
      this.db.$queryRawUnsafe(`SELECT * FROM ${table}.version_records WHERE to_tsvector('simple', semantic_title || ' ' || status || ' ' || commit_sha) @@ plainto_tsquery('simple',$1) ORDER BY id`, query),
      this.db.$queryRawUnsafe(`SELECT * FROM ${table}.snapshot_records WHERE to_tsvector('simple', semantic_title || ' ' || content_summary) @@ plainto_tsquery('simple',$1) ORDER BY snapshot_id`, query),
      this.db.$queryRawUnsafe(`SELECT * FROM ${table}.canonical_source_records WHERE to_tsvector('simple', fact_key || ' ' || human_title || ' ' || description || ' ' || canonical_source) @@ plainto_tsquery('simple',$1) ORDER BY id`, query),
      this.db.$queryRawUnsafe(`SELECT * FROM ${table}.canonical_source_changes WHERE to_tsvector('simple', semantic_title || ' ' || fact_key || ' ' || reason || ' ' || old_source || ' ' || new_source) @@ plainto_tsquery('simple',$1) ORDER BY id`, query),
      this.db.$queryRawUnsafe(`SELECT * FROM ${table}.production_change_records WHERE to_tsvector('simple', semantic_title || ' ' || description || ' ' || impact_study || ' ' || rollback_plan) @@ plainto_tsquery('simple',$1) ORDER BY id`, query),
      this.db.$queryRawUnsafe(`SELECT * FROM ${table}.worktree_records WHERE to_tsvector('simple', semantic_title || ' ' || description || ' ' || purpose_phase) @@ plainto_tsquery('simple',$1) ORDER BY worktree_id`, query),
    ]);
    const incidentRows = incidents as Array<Record<string, unknown>>;
    const versionRows = versions as Array<Record<string, unknown>>;
    return { incidents, versions, snapshots, sources, cscs, pcrs, worktrees, total: incidents.length + versions.length + snapshots.length + sources.length + cscs.length + pcrs.length + worktrees.length, strong: incidentRows.some((row) => Boolean(row.test_evidence && row.validator)) || versionRows.some((row) => Boolean(row.validation_evidence && row.final_verdict)) };
  }

  async createRiskKnowledgeAssessment(assessment: RiskKnowledgeAssessment) {
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.risk_knowledge_assessments (assessment_id,proposal_id,pcr_id,generated_at,scope,affected_components,canonical_facts,direct_dependencies,transitive_dependencies,unknown_impact,historical_regression_impact,relevant_incidents,relevant_versions,relevant_cscs,relevant_pcrs,relevant_snapshots,remediation_evidence,precedent_summary,risk_findings,unknowns,mandatory_tests,recommended_controls,verdict,conditions,evidence_strength,confidence,correlation_id,human_override) VALUES ($1,$2,$3,$4::timestamptz,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18,$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23,$24::jsonb,$25,$26,$27,$28::jsonb)`, assessment.assessmentId, assessment.proposalId, assessment.pcrId ?? null, assessment.generatedAt, assessment.scope, JSON.stringify(assessment.affectedComponents), JSON.stringify(assessment.canonicalFacts), JSON.stringify(assessment.directDependencies), JSON.stringify(assessment.transitiveDependencies), JSON.stringify(assessment.unknownImpact), JSON.stringify(assessment.historicalRegressionImpact), JSON.stringify(assessment.relevantIncidents), JSON.stringify(assessment.relevantVersions), JSON.stringify(assessment.relevantCscs), JSON.stringify(assessment.relevantPcrs), JSON.stringify(assessment.relevantSnapshots), JSON.stringify(assessment.remediationEvidence), assessment.precedentSummary, JSON.stringify(assessment.riskFindings), JSON.stringify(assessment.unknowns), JSON.stringify(assessment.mandatoryTests), JSON.stringify(assessment.recommendedControls), assessment.verdict, JSON.stringify(assessment.conditions), assessment.evidenceStrength, assessment.confidence, assessment.correlationId, assessment.humanOverride ? JSON.stringify(assessment.humanOverride) : null);
    await this.recordEvent('RISK_KNOWLEDGE_ASSESSMENT_CREATED', 'RiskKnowledgeAssessment', assessment.assessmentId, 'risk-knowledge-orchestrator', assessment, []);
    return this.readRiskKnowledgeAssessment(assessment.assessmentId);
  }
  async readRiskKnowledgeAssessment(id: string) { const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ${table}.risk_knowledge_assessments WHERE assessment_id=$1`, id); return rows[0] ?? null; }
  async searchRiskKnowledgeAssessments(query: string) { return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.risk_knowledge_assessments WHERE to_tsvector('simple', scope || ' ' || precedent_summary) @@ plainto_tsquery('simple',$1) ORDER BY generated_at DESC, assessment_id`, query); }
  async recordRiskKnowledgeOverride(id: string, override: NonNullable<RiskKnowledgeAssessment['humanOverride']>) {
    const existing = await this.readRiskKnowledgeAssessment(id) as Record<string, unknown> | null;
    if (!existing) throw new Error('RISK_ASSESSMENT_NOT_FOUND');
    if (!['BLOCK', 'REVIEW_REQUIRED'].includes(String(existing.verdict))) throw new Error('RISK_OVERRIDE_VERDICT_INVALID');
    await this.db.$executeRawUnsafe(`UPDATE ${table}.risk_knowledge_assessments SET human_override=$2::jsonb WHERE assessment_id=$1`, id, JSON.stringify(override));
    await this.recordEvent('RISK_KNOWLEDGE_OVERRIDE_RECORDED', 'RiskKnowledgeAssessment', id, override.authorizedHumanId, { originalVerdict: existing.verdict, override }, [override.pcrId]);
    return this.readRiskKnowledgeAssessment(id);
  }

  async registerWorktree(input: { worktreeId: string; semanticTitle: string; description: string; path: string; branch: string; baseCommit: string; purposePhase: string; status: string; ownerExecutor: string; candidateRef?: string; snapshotRef?: string; modifiedFilesCount: number; untrackedFilesCount: number; evidenceRefs: string[]; migrationRefs: string[]; lastActivityAt: string; tests: string[]; relatedIncident?: string; relatedCSC?: string; relatedPCR?: string; relatedVersion?: string; preservationStatus: string; safeToRemove: boolean; removalReason: string }) {
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.worktree_records (worktree_id,semantic_title,description,path,branch,base_commit,purpose_phase,status,owner_executor,candidate_ref,snapshot_ref,modified_files_count,untracked_files_count,evidence_refs,migration_refs,last_activity_at,tests,related_incident,related_csc,related_pcr,related_version,preservation_status,safe_to_remove,removal_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::timestamptz,$17::jsonb,$18,$19,$20,$21,$22,$23,$24)`, input.worktreeId, input.semanticTitle, input.description, input.path, input.branch, input.baseCommit, input.purposePhase, input.status, input.ownerExecutor, input.candidateRef ?? null, input.snapshotRef ?? null, input.modifiedFilesCount, input.untrackedFilesCount, JSON.stringify(input.evidenceRefs), JSON.stringify(input.migrationRefs), input.lastActivityAt, JSON.stringify(input.tests), input.relatedIncident ?? null, input.relatedCSC ?? null, input.relatedPCR ?? null, input.relatedVersion ?? null, input.preservationStatus, input.safeToRemove, input.removalReason);
  }

  async appendEvent(input: { eventId: string; eventType: string; semanticTitle: string; entityType: string; entityId: string; previousEventId?: string; relation?: string; previousDigest?: string; payload: unknown; correlationId: string; actorId: string; occurredAt: string; evidenceRefs: string[] }) {
    await this.db.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('agm_governance_events'))`);
    const tail = await this.db.$queryRawUnsafe<{ event_id: string; event_digest: string }>(`SELECT event_id,event_digest FROM ${table}.governance_events ORDER BY recorded_at DESC,event_id DESC LIMIT 1`);
    if (tail[0] && (input.previousEventId !== tail[0].event_id || input.previousDigest !== tail[0].event_digest)) throw new Error('GOVERNANCE_EVENT_STALE_TAIL');
    if (!tail[0] && (input.previousEventId || input.previousDigest)) throw new Error('GOVERNANCE_EVENT_INVALID_INITIAL_LINK');
    const payloadDigest = digest(input.payload);
    const eventDigest = digest({ eventId: input.eventId, eventType: input.eventType, entityType: input.entityType, entityId: input.entityId, previousDigest: input.previousDigest ?? null, payloadDigest, correlationId: input.correlationId, actorId: input.actorId });
    await this.db.$executeRawUnsafe(`INSERT INTO ${table}.governance_events (event_id,event_type,semantic_title,entity_type,entity_id,previous_event_id,relation,previous_digest,payload_digest,event_digest,correlation_id,actor_id,occurred_at,evidence_refs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14::jsonb)`, input.eventId, input.eventType, input.semanticTitle, input.entityType, input.entityId, input.previousEventId ?? null, input.relation ?? null, input.previousDigest ?? null, payloadDigest, eventDigest, input.correlationId, input.actorId, input.occurredAt, JSON.stringify(input.evidenceRefs));
    return { eventDigest, payloadDigest };
  }

  async listGovernanceEvents(entityId?: string) { return this.db.$queryRawUnsafe(`SELECT * FROM ${table}.governance_events ${entityId ? 'WHERE entity_id=$1' : ''} ORDER BY recorded_at,event_id`, ...(entityId ? [entityId] : [])); }

  async ledgerDigest() {
    const rows = await this.db.$queryRawUnsafe<{ event_digest: string }>(`SELECT event_digest FROM ${table}.governance_events ORDER BY recorded_at, event_id`);
    return digest(rows.map((row) => row.event_digest));
  }
}
