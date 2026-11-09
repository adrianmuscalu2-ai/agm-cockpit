import { GovernanceV2Persistence } from './governance-v2.persistence';
import type { CanonicalSourceChange, CanonicalSourceRecord, GovernanceActorPrincipal, GovernanceDependencyEdge, GovernanceProposal, IncidentRecord, ProductionChangeRecord, RecoveryEvidenceRecord, SnapshotRecord, VersionRecord } from './governance-v2.contract';
import { RiskKnowledgeOrchestrator, type RiskKnowledgeProposal } from './risk-knowledge-orchestrator';

/**
 * Runtime boundary for Governance V2. It deliberately owns no in-memory
 * governance state: reads and writes are delegated to the persistent adapter.
 * Nest wiring is a separate integration gate because the protected candidate
 * schema is not changed by this phase.
 */
export class GovernanceV2RuntimeService {
  constructor(private readonly persistence: GovernanceV2Persistence) {}

  readCanonicalSource(factKey: string) { return this.persistence.activeSource(factKey); }
  listCanonicalSources(factKey?: string) { return this.persistence.listCanonicalSources(factKey); }
  createCanonicalSource(input: Omit<CanonicalSourceRecord, 'createdAt' | 'updatedAt' | 'status'> & { status?: CanonicalSourceRecord['status'] }, actorId: string) { return this.transaction((p) => p.createCanonicalSource(input, actorId)); }
  requestCanonicalSourceChange(input: Omit<CanonicalSourceChange, 'status' | 'approvalStatus' | 'validationEvidence'>) { return this.transaction((p) => p.requestCanonicalSourceChange(input)); }
  transitionCanonicalSourceChange(id: string, transition: 'IMPACT_ASSESSED' | 'APPROVED' | 'VALIDATED' | 'ACTIVATED', actorId: string, evidence: string[] = [], version?: string) { return this.transaction((p) => p.transitionCsc(id, transition, actorId, evidence, version)); }
  readCanonicalSourceChange(id: string) { return this.persistence.readCsc(id); }
  registerGovernanceActor(input: GovernanceActorPrincipal) { return this.transaction((p) => p.registerGovernanceActor(input)); }
  bindActorIdentity(input: Parameters<GovernanceV2Persistence['bindActorIdentity']>[0]) { return this.transaction((p) => p.bindActorIdentity(input)); }
  readActorIdentityBinding(principalType: Parameters<GovernanceV2Persistence['readActorIdentityBinding']>[0], principalId: string) { return this.persistence.readActorIdentityBinding(principalType, principalId); }
  resolveAuthenticatedActor(principal: Parameters<GovernanceV2Persistence['resolveAuthenticatedActor']>[0], capability?: 'propose' | 'validate') { return this.persistence.resolveAuthenticatedActor(principal, capability); }
  readGovernanceActor(id: string) { return this.persistence.readGovernanceActor(id); }
  listGovernanceActors() { return this.persistence.listGovernanceActors(); }
  createProposal(input: GovernanceProposal) { return this.transaction((p) => p.createProposal(input)); }
  readProposal(id: string) { return this.persistence.readProposal(id); }
  listProposals() { return this.persistence.listProposals(); }
  searchProposals(query: string) { return this.persistence.searchProposals(query); }
  transitionProposal(id: string, target: GovernanceProposal['status'], actorId: string, evidenceRefs: string[] = []) { return this.transaction((p) => p.transitionProposal(id, target, actorId, evidenceRefs)); }
  decideProposal(id: string, decision: 'ACCEPTED_FOR_CHANGE_CONTROL' | 'REJECTED', actorId: string, evidenceRefs: string[] = []) { return this.transaction((p) => p.decideProposal(id, decision, actorId, evidenceRefs)); }
  reconcileHistoricalProposal(input: GovernanceProposal, importerId: string, historicalEvidenceAt: string) { return this.transaction((p) => p.reconcileHistoricalProposal(input, importerId, historicalEvidenceAt)); }
  createRecoveryEvidence(input: RecoveryEvidenceRecord) { return this.transaction((p) => p.createRecoveryEvidence(input)); }
  readRecoveryEvidence(id: string) { return this.persistence.readRecoveryEvidence(id); }
  listRecoveryEvidence(candidateDigest?: string) { return this.persistence.listRecoveryEvidence(candidateDigest); }
  searchRecoveryEvidence(query: string) { return this.persistence.searchRecoveryEvidence(query); }
  listGovernanceEvents(entityId?: string) { return this.persistence.listGovernanceEvents(entityId); }
  reconcileHistoricalRecoveryEvidence(input: RecoveryEvidenceRecord, importerId: string, historicalExecutionAt: string) { return this.transaction((p) => p.reconcileHistoricalRecoveryEvidence(input, importerId, historicalExecutionAt)); }
  addDependencyEdge(edge: GovernanceDependencyEdge, actorId: string) { return this.transaction((p) => p.addDependencyEdge(edge, actorId)); }
  createProductionChange(input: Omit<ProductionChangeRecord, 'status' | 'approvalStatus' | 'dependencyChecks'>) { return this.transaction((p) => p.createProductionChange(input)); }
  readPcr(id: string) { return this.persistence.readPcr(id); }
  assessProductionChange(id: string, actorId: string) { return this.transaction((p) => p.assessProductionChange(id, actorId)); }
  recordDependencyResult(id: string, component: string, result: string, actorId: string) { return this.transaction((p) => p.recordDependencyResult(id, component, result, actorId)); }
  recordDependencyGraphStatus(id: string, status: 'COMPLETE' | 'INCOMPLETE' | 'UNKNOWN', evidenceRef: string, actorId: string) { return this.transaction((p) => p.recordDependencyGraphStatus(id, status, evidenceRef, actorId)); }
  recordAcceptedDegradation(id: string, component: string, humanApprovalId: string, rationale: string, evidenceRef: string, actorId: string, expiry?: string) { return this.transaction((p) => p.recordAcceptedDegradation(id, component, humanApprovalId, rationale, evidenceRef, actorId, expiry)); }
  approveProductionChange(id: string, actorId: string) { return this.transaction((p) => p.approveProductionChange(id, actorId)); }
  evaluateProductionReleaseGate(id: string, actorId: string, binding?: { candidateRef: string; versionId: string; revision: string; artifactDigest?: string }) { return this.transaction((p) => p.evaluateProductionReleaseGate(id, actorId, binding)); }
  recordProductionExecution(id: string, actorId: string, revision: string, binding?: { candidateRef: string; versionId: string; artifactDigest?: string }) { return this.transaction((p) => p.recordProductionExecution(id, actorId, revision, binding)); }
  validateProductionChange(id: string, actorId: string, evidence: string[], verdict: 'PASS' | 'FAIL') { return this.transaction((p) => p.validateProductionChange(id, actorId, evidence, verdict)); }
  createVersion(version: VersionRecord, actorId: string) { return this.transaction((p) => p.createVersion(version, actorId)); }
  readVersion(id: string) { return this.persistence.readVersion(id); }
  promoteVersion(id: string, target: VersionRecord['status'], actorId: string) { return this.transaction((p) => p.promoteVersion(id, target, actorId)); }
  createSnapshot(snapshot: SnapshotRecord, actorId: string) { return this.transaction((p) => p.createSnapshot(snapshot, actorId)); }
  readSnapshot(id: string) { return this.persistence.readSnapshot(id); }
  createIncident(incident: IncidentRecord) { return this.transaction((p) => p.createIncident(incident)); }
  createBreakGlassAuthorization(input: import('./governance-v2.contract').BreakGlassAuthorization) { return this.transaction((p) => p.createBreakGlassAuthorization(input)); }
  validateBreakGlassForExecution(id: string, executorId: string, at?: string) { return this.transaction((p) => p.validateBreakGlassForExecution(id, executorId, at)); }
  recordBreakGlassExecuted(id: string, executorId: string) { return this.transaction((p) => p.recordBreakGlassExecuted(id, executorId)); }
  recordBreakGlassValidation(id: string, validatorId: string, evidence: string[], verdict: 'VALIDATED'|'FAILED') { return this.transaction((p) => p.recordBreakGlassValidation(id, validatorId, evidence, verdict)); }
  searchSnapshots(query: string) { return this.persistence.searchSnapshots(query); }
  searchWorktrees(query: string) { return this.persistence.searchWorktrees(query); }
  searchRiskKnowledge(query: string) { return this.persistence.searchRiskKnowledge(query); }
  readRiskKnowledgeAssessment(id: string) { return this.persistence.readRiskKnowledgeAssessment(id); }
  searchRiskKnowledgeAssessments(query: string) { return this.persistence.searchRiskKnowledgeAssessments(query); }
  recordRiskKnowledgeOverride(id: string, override: NonNullable<import('./governance-v2.contract').RiskKnowledgeAssessment['humanOverride']>) { return this.transaction(() => this.persistence.recordRiskKnowledgeOverride(id, override)); }
  assessStructuralChange(input: RiskKnowledgeProposal) { return new RiskKnowledgeOrchestrator(this.persistence).assessStructuralChange(input); }
  searchBreakGlass(query: string) { return this.persistence.searchBreakGlass(query); }
  impactedComponents(component: string) { return this.persistence.impactedComponents(component); }
  transaction<T>(work: (persistence: GovernanceV2Persistence) => Promise<T>) { return this.persistence.transaction(() => work(this.persistence)); }
}
