export type GovernanceStatus = 'ACTIVE' | 'SUPERSEDED' | 'REJECTED' | 'ABORTED' | 'ROLLED_BACK';
export type ImpactClass = 'LOW' | 'CONTROLLED' | 'STRUCTURAL';
export type GovernanceActorRole = 'PROPOSER' | 'APPROVER' | 'EXECUTOR' | 'VALIDATOR';
export type CscStatus = 'DRAFT' | 'IMPACT_ASSESSED' | 'APPROVED' | 'VALIDATED' | 'ACTIVATED' | 'REJECTED' | 'ABORTED' | 'ROLLED_BACK' | 'SUPERSEDED';
export type PcrStatus = 'DRAFT' | 'IMPACT_ASSESSED' | 'CANDIDATE_READY' | 'VALIDATED' | 'APPROVED' | 'DEPLOYED' | 'POST_DEPLOY_VERIFIED' | 'CLOSED' | 'REJECTED' | 'ABORTED' | 'ROLLED_BACK' | 'FAILED_VALIDATION';
export type VersionStatus = 'WIP' | 'CANDIDATE' | 'VALIDATED' | 'CANONICAL' | 'DEPLOYED' | 'SUPERSEDED' | 'ABANDONED' | 'ROLLED_BACK' | 'REJECTED';

export type ProposalStatus = 'DRAFT' | 'REVIEWED' | 'ACCEPTED_FOR_CHANGE_CONTROL' | 'SUPERSEDED' | 'REJECTED' | 'ABANDONED';
export type RecoveryType = 'RESTART' | 'BACKUP_RESTORE' | 'ROLLBACK_DRILL' | 'FAILOVER_RECOVERY';
export type RecoveryVerdict = 'PASS' | 'FAIL' | 'PARTIAL' | 'UNKNOWN';
export type RecoveryEnvironmentClass = 'DISPOSABLE' | 'CONTROLLED_LOCAL' | 'STAGING' | 'PRODUCTION';
export const MACHINE_CANDIDATE_BINDING = {
  candidateRef: 'Machine Canonical Authority & Precedence v1',
  candidateDigest: '33409ea8099e18fac0d20a0c972be945cb33ce51e172df147f0b981c0451879d',
} as const;

export type GovernanceProposal = {
  proposalId: string; semanticTitle: string; description: string; scope: string; proposalType: string;
  proposerId: string; createdAt: string; updatedAt: string; candidateRef: string; candidateDigest: string;
  baseRevision: string; affectedComponents: string[]; affectedFacts: string[]; correlationId: string;
  status: ProposalStatus; evidenceRefs: string[]; riskAssessmentRefs: string[]; impactStudyRef: string;
  dependencyGraphRef: string; snapshotRef: string; versionRef?: string; pcrRefs: string[]; cscRefs: string[];
  historicalEvidenceAt?: string; reconciledAt?: string; importerId?: string;
};

export type RecoveryEvidenceRecord = {
  recoveryEvidenceId: string; recoveryType: RecoveryType; candidateRef: string; candidateDigest: string;
  versionId: string; proposalId?: string; pcrId: string; snapshotRef: string; environmentClass: RecoveryEnvironmentClass;
  startedAt: string; completedAt?: string; executorId: string; validatorId?: string; correlationId: string;
  backupRef?: string; backupSha256?: string; sourceDbRef?: string; sourceEnvironmentRef?: string; restoreTargetRef?: string;
  destroyVerified?: boolean; restoreVerified?: boolean; postRestoreStartupVerified?: boolean; readinessResult?: string;
  criticalTestsResult?: string; rollbackPlanRef: string; evidenceRefs: string[]; contractVersion: string;
  verdict: RecoveryVerdict; notes?: string; reasonCode?: string; historicalExecutionAt?: string; reconciledAt?: string; importerId?: string;
};

export type GovernanceActor = { id: string; roles: GovernanceActorRole[] };
export type GovernanceActorPrincipal = GovernanceActor & { displayName: string; canPropose: boolean; canValidate: boolean; canExecute: boolean; status: 'ACTIVE' | 'REVOKED' };

export type CanonicalSourceRecord = {
  id: string; factKey: string; humanTitle: string; description: string; canonicalSource: string;
  writeAuthority: string; validatorAuthority: string; readers: string[]; precedence: number;
  conflictBehavior: 'REJECT' | 'PRESERVE_BOTH_ESCALATE' | 'STALE_DETAIL' | 'UNKNOWN' | 'FAIL_CLOSED';
  contractVersion: string; status: 'ACTIVE' | 'SUPERSEDED'; activatedAt: string; supersededAt?: string; supersededBy?: string;
  createdAt: string; updatedAt: string;
};

export type CanonicalSourceChange = {
  id: string; semanticTitle: string; factKey: string; oldSource: string; newSource: string;
  oldWriteAuthority: string; newWriteAuthority: string; oldPrecedence: number; newPrecedence: number;
  reason: string; impactStudyRef: string; migrationPlanRef: string; testPlanRef: string; rollbackPlanRef: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'; approvedBy?: string; activatedVersion?: string;
  activatedAt?: string; validationEvidence: string[]; status: CscStatus; proposerId: string; validatorId?: string;
  proposalId?: string; pcrId?: string; candidateDigest?: string; correlationId?: string;
};

export type GovernanceDependencyEdge = {
  id: string; sourceComponent: string; relation: 'DEPENDS_ON' | 'READS_FROM' | 'WRITES_TO' | 'VALIDATED_BY' | 'DISPLAYED_IN' | 'AUTHENTICATED_BY' | 'PERSISTS_TO' | 'PROJECTED_BY' | 'GOVERNS' | 'AFFECTS';
  targetComponent: string; criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; validationRequired: boolean; introducedAt: string; supersededAt?: string;
};

export type ProductionChangeRecord = {
  id: string; semanticTitle: string; description: string; impactClass: ImpactClass; affectedComponents: string[];
  affectedCanonicalSources: string[]; dependencyImpactRef: string; impactStudy: string; testPlan: string;
  rollbackPlan: string; snapshotRef: string; candidateRef: string; approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  deployRevision?: string; deploymentRef?: string; postDeployVerification?: string; finalVerdict?: 'PASS' | 'FAIL' | 'UNKNOWN'; candidateDigest?: string;
  relatedIncidents: string[]; relatedCSC: string[]; proposerId: string; approverId?: string; executorId?: string; validatorId?: string;
  proposalId?: string;
  dependencyChecks: Record<string, 'PASS' | 'FAIL' | 'UNKNOWN' | 'EXPLICIT_ACCEPTED_DEGRADATION'>; status: PcrStatus; schemaChange?: boolean; migrationRef?: string; migrationRisk?: string; backwardCompatibilityImpact?: string;
};

export type GovernanceEvent = {
  eventId: string; eventType: 'CREATED' | 'APPROVED' | 'VALIDATED' | 'ACTIVATED' | 'CORRECTS' | 'SUPERSEDES' | 'REVOKES' | 'ROLLS_BACK' | 'CLOSES' | 'SECURITY_ALERT' | 'PROPOSAL_CREATED' | 'PROPOSAL_REVIEWED' | 'PROPOSAL_STATUS_CHANGED' | 'ACTOR_REGISTERED' | 'RECOVERY_EVIDENCE_CREATED' | 'RECOVERY_EVIDENCE_RECONCILED';
  semanticTitle: string; entityType: string; entityId: string; previousEventId?: string; relation?: string; payloadDigest: string;
  correlationId: string; actorId: string; occurredAt: string; recordedAt: string; evidenceRefs: string[]; previousDigest?: string;
};

export type VersionRecord = {
  id: string; semanticTitle: string; status: VersionStatus; baseRevision: string; commitSha: string; artifactDigests: string[]; candidateDigest?: string;
  candidateSnapshot: string; validationEvidence: string[]; pcrRefs: string[]; cscRefs: string[]; incidentRefs: string[];
  deployedEnvironment?: string; deployedAt?: string; rollbackRevision?: string; supersededBy?: string; finalVerdict?: 'PASS' | 'FAIL' | 'UNKNOWN';
};

export type SnapshotRecord = {
  snapshotId: string; semanticTitle: string; contentSummary: string; tags: string[]; status: 'WIP' | 'CANDIDATE' | 'PRESERVED' | 'PROMOTED' | 'SUPERSEDED' | 'ABANDONED';
  branch: string; baseCommit: string; worktree: string; manifestDigest: string; snapshotDigest: string; changedFiles: string[]; untrackedFiles: string[];
  tests: string[]; relatedVersion?: string; relatedIncident?: string; relatedCSC?: string; relatedPCR?: string; createdAt: string;
};

export type IncidentRecord = {
  id: string; semanticTitle: string; symptom: string; reproduction: string; rootCause: string; rootCauseClassification: string;
  attemptedFixes: string[]; appliedRemediation: string; testEvidence: string[]; validator: string; humanValidation?: string;
  introducedVersion?: string; fixedVersion?: string; relatedCSC: string[]; relatedPCR: string[]; prevention: string; similarIncidents: string[]; closureEvidence?: string;
};

export type BreakGlassAuthorization = {
  id: string; authorizedHumanId: string; authorityRole: string; requesterId: string; incidentId: string;
  reason: string; scopeComponent: string; scopeOperation: string; releaseVersion: string; commitSha: string;
  startedAt: string; expiresAt: string; backupRef: string; snapshotRef: string; rollbackPlan: string;
  expectedImpact: string; riskAcceptance: string; correlationId: string; status?: 'AUTHORIZED' | 'EXECUTED' | 'VALIDATED' | 'FAILED' | 'EXPIRED';
  executorId?: string; validatorId?: string; validationEvidence?: string[];
};

export type RiskVerdict = 'ALLOW' | 'ALLOW_WITH_CONDITIONS' | 'REVIEW_REQUIRED' | 'BLOCK' | 'INSUFFICIENT_EVIDENCE';
export type EvidenceStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT';
export type RiskCategory = 'CANONICAL_SOURCE' | 'AUTHORITY' | 'DATA_INTEGRITY' | 'DEPENDENCY' | 'VERSION' | 'RECOVERY' | 'PRODUCTION' | 'SECURITY' | 'AUTH' | 'API' | 'WEB' | 'ANDROID' | 'MACHINE' | 'TURN' | 'EXTERNAL_INTEGRATION' | 'MIGRATION' | 'HUMAN_OPERATION';
export type RiskKnowledgeCondition = { id: string; action: string; evidenceRequired: string; ownerRole: string; status: 'REQUIRED' | 'SATISFIED' };
export type RiskKnowledgeAssessment = {
  assessmentId: string; proposalId: string; pcrId?: string; generatedAt: string; scope: string;
  affectedComponents: string[]; canonicalFacts: string[]; directDependencies: string[]; transitiveDependencies: string[];
  unknownImpact: string[]; historicalRegressionImpact: string[]; relevantIncidents: string[]; relevantVersions: string[];
  relevantCscs: string[]; relevantPcrs: string[]; relevantSnapshots: string[]; remediationEvidence: string[];
  precedentSummary: string; riskFindings: Array<{ category: RiskCategory; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; reason: string }>;
  unknowns: string[]; mandatoryTests: string[]; recommendedControls: string[]; verdict: RiskVerdict;
  conditions: RiskKnowledgeCondition[]; evidenceStrength: EvidenceStrength; confidence: number; correlationId: string;
  humanOverride?: { authorizedHumanId: string; reason: string; evidence: string[]; acceptedRisk: string; pcrId: string; timestamp: string; scope: string; expiresAt?: string };
};
