import { randomUUID } from 'node:crypto';
import type { RiskKnowledgeAssessment, RiskKnowledgeCondition, RiskVerdict } from './governance-v2.contract';
import { GovernanceV2Persistence } from './governance-v2.persistence';

export type RiskKnowledgeProposal = {
  assessmentId: string; proposalId: string; pcrId?: string; scope: string; query: string;
  affectedComponents: string[]; canonicalFacts: string[]; directDependencies?: string[]; dependencyEvidenceComplete?: boolean;
  provenanceComplete?: boolean; validationEvidenceComplete?: boolean; recoveryEvidenceComplete?: boolean; productionValidationPending?: boolean; mandatoryTests?: string[]; correlationId?: string;
};

/** Advisory-only memory challenge. It never mutates canonical, CSC, PCR, version, snapshot, or dependency records. */
export class RiskKnowledgeOrchestrator {
  constructor(private readonly persistence: GovernanceV2Persistence) {}

  async assessStructuralChange(input: RiskKnowledgeProposal): Promise<RiskKnowledgeAssessment> {
    if (!input.assessmentId || !input.proposalId || !input.scope || !input.query || !input.affectedComponents.length) throw new Error('RISK_REVIEW_INPUT_INCOMPLETE');
    let evidence: Awaited<ReturnType<GovernanceV2Persistence['searchRiskKnowledge']>>;
    try { evidence = await this.persistence.searchRiskKnowledge(input.query); }
    catch { return this.persist(this.incomplete(input, 'Governance evidence unavailable')); }
    if (![evidence.incidents, evidence.versions, evidence.snapshots, evidence.sources, evidence.cscs, evidence.pcrs, evidence.worktrees].every(Array.isArray) || typeof evidence.total !== 'number') return this.persist(this.incomplete(input, 'Governance evidence malformed'));
    const incidents = evidence.incidents as Array<Record<string, unknown>>;
    const versions = evidence.versions as Array<Record<string, unknown>>;
    const cscs = evidence.cscs as Array<Record<string, unknown>>;
    const pcrs = evidence.pcrs as Array<Record<string, unknown>>;
    const snapshots = evidence.snapshots as Array<Record<string, unknown>>;
    const directDependencies = input.directDependencies ?? [];
    const unknowns: string[] = [];
    const findings: RiskKnowledgeAssessment['riskFindings'] = [];
    const conditions: RiskKnowledgeCondition[] = [];
    const incidentIds = incidents.map((row) => String(row.incident_id));
    const versionIds = versions.map((row) => String(row.id));
    const cscIds = cscs.map((row) => String(row.id));
    const pcrIds = pcrs.map((row) => String(row.id));
    const snapshotIds = snapshots.map((row) => String(row.snapshot_id));
    if (!incidents.length && !versions.length && !cscs.length && !pcrs.length && !snapshots.length) {
      unknowns.push('NO_RELEVANT_PRECEDENT_FOUND');
      findings.push({ category: 'DATA_INTEGRITY', severity: 'HIGH', reason: 'No provenance-backed precedent was found for a structural proposal.' });
    }
    if (input.provenanceComplete !== true) { unknowns.push('PROVENANCE_INCOMPLETE'); findings.push({ category: 'VERSION', severity: 'HIGH', reason: 'Proposal provenance is not explicitly complete.' }); }
    if (input.dependencyEvidenceComplete !== true) { unknowns.push('DEPENDENCY_IMPACT_UNKNOWN'); findings.push({ category: 'DEPENDENCY', severity: 'HIGH', reason: 'Dependency evidence is not explicitly complete; UNKNOWN cannot become NONE.' }); }
    const failed = incidents.some((row) => /failed|rejected|rolled.?back|abandoned/i.test(JSON.stringify(row)) && (!row.applied_remediation || /failed|rejected|rolled.?back|abandoned/i.test(String(row.applied_remediation)))) || cscs.some((row) => /rejected|rolled.?back|aborted/i.test(JSON.stringify(row)));
    if (failed) { findings.push({ category: 'PRODUCTION', severity: 'CRITICAL', reason: 'Relevant history contains a failed, rejected, rolled-back, or abandoned precedent.' }); }
    if (incidents.some((row) => !row.human_validation || !row.test_evidence)) { unknowns.push('INCIDENT_VALIDATION_INCOMPLETE'); }
    conditions.push({ id: 'independent-validator', action: 'Obtain independent validation before approval', evidenceRequired: 'validator evidence reference', ownerRole: 'VALIDATOR', status: input.validationEvidenceComplete ? 'SATISFIED' : 'REQUIRED' });
    conditions.push({ id: 'recovery-drill', action: 'Run and preserve recovery/rollback drill', evidenceRequired: 'backup and rollback evidence', ownerRole: 'RECOVERY_OWNER', status: input.recoveryEvidenceComplete ? 'SATISFIED' : 'REQUIRED' });
    if (input.productionValidationPending) conditions.push({ id: 'production-validation', action: 'Complete separately approved Production validation', evidenceRequired: 'Production validation evidence', ownerRole: 'OWNER', status: 'REQUIRED' });
    const verdict: RiskVerdict = failed ? 'BLOCK' : unknowns.includes('PROVENANCE_INCOMPLETE') || unknowns.includes('DEPENDENCY_IMPACT_UNKNOWN') ? 'REVIEW_REQUIRED' : (!incidents.length && !versions.length ? 'REVIEW_REQUIRED' : 'ALLOW_WITH_CONDITIONS');
    const assessment: RiskKnowledgeAssessment = { assessmentId: input.assessmentId, proposalId: input.proposalId, pcrId: input.pcrId, generatedAt: new Date().toISOString(), scope: input.scope, affectedComponents: input.affectedComponents, canonicalFacts: input.canonicalFacts, directDependencies, transitiveDependencies: [], unknownImpact: unknowns.filter((value) => value.includes('DEPENDENCY')), historicalRegressionImpact: failed ? ['RECURRING_RISK_OR_FAILED_PRECEDENT'] : [], relevantIncidents: incidentIds, relevantVersions: versionIds, relevantCscs: cscIds, relevantPcrs: pcrIds, relevantSnapshots: snapshotIds, remediationEvidence: incidents.map((row) => String(row.applied_remediation ?? '')).filter(Boolean), precedentSummary: incidents.length || versions.length ? `Found ${incidents.length} incident(s) and ${versions.length} version precedent(s).` : 'NO RELEVANT PRECEDENT FOUND', riskFindings: findings, unknowns, mandatoryTests: input.mandatoryTests ?? ['regression evidence', 'independent validation'], recommendedControls: ['snapshot before change', 'preserve rollback evidence'], verdict, conditions, evidenceStrength: evidence.strong ? 'STRONG' : evidence.total ? 'MODERATE' : 'INSUFFICIENT', confidence: evidence.total ? Math.min(0.95, 0.4 + evidence.total * 0.05) : 0.1, correlationId: input.correlationId ?? randomUUID() };
    return this.persist(assessment);
  }

  private incomplete(input: RiskKnowledgeProposal, reason: string): RiskKnowledgeAssessment { return { assessmentId: input.assessmentId, proposalId: input.proposalId, pcrId: input.pcrId, generatedAt: new Date().toISOString(), scope: input.scope, affectedComponents: input.affectedComponents, canonicalFacts: input.canonicalFacts, directDependencies: input.directDependencies ?? [], transitiveDependencies: [], unknownImpact: [reason], historicalRegressionImpact: [], relevantIncidents: [], relevantVersions: [], relevantCscs: [], relevantPcrs: [], relevantSnapshots: [], remediationEvidence: [], precedentSummary: reason, riskFindings: [{ category: 'DATA_INTEGRITY', severity: 'HIGH', reason }], unknowns: [reason], mandatoryTests: input.mandatoryTests ?? ['restore evidence', 'independent validation'], recommendedControls: ['do not approve structural change'], verdict: 'INSUFFICIENT_EVIDENCE', conditions: [], evidenceStrength: 'INSUFFICIENT', confidence: 0, correlationId: input.correlationId ?? randomUUID() }; }
  private async persist(assessment: RiskKnowledgeAssessment) { await this.persistence.transaction(() => this.persistence.createRiskKnowledgeAssessment(assessment)); return assessment; }
}
