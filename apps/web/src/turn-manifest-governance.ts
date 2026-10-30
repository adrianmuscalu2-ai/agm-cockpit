import { turnModuleNavigationRegistry, type TurnModuleNavigationEntry } from './turn-module-navigation.registry';

export type ManifestDecision = 'DA' | 'NU';
export type ManifestLifecycleState = 'IMPLEMENTED' | 'IMPLEMENTED_NOT_VALIDATED' | 'BLOCKED' | 'UNKNOWN';

export type ManifestJournalDecision = {
  journalId: string;
  journal: string;
  roleId: string;
  roleName: string;
  roleStatus: 'CANONICAL_REGISTRY' | 'IMPLEMENTED_SOURCE' | 'NAVIGATION_ONLY' | 'UNKNOWN';
  duty: string;
  authorityBoundary: string;
  validatorRole: string;
  roleEvidence: string[];
  historicalRoleEvidence?: string[];
  missingRoleEvidence?: string[];
  responsible: string;
  canonicalSource: string;
  implementation: ManifestLifecycleState;
  verification: 'VERIFIED' | 'NOT_VERIFIED';
  committed: 'COMMITTED' | 'NOT_COMMITTED' | 'UNKNOWN';
  production: 'ACTIVE' | 'NOT_ACTIVE' | 'UNKNOWN';
  decision: ManifestDecision;
  reason: string;
  evidence: string[];
};

const manifestPath = 'release/turn-20261028/RELEASE_MANIFEST.json';
const registryPath = 'apps/web/src/turn-module-navigation.registry.ts';
const checklistPath = 'release/turn-20261028/PRE_CHANGE_CHECKLIST.md';

const roleAssignments: Record<string, Pick<ManifestJournalDecision, 'roleId' | 'roleName' | 'roleStatus' | 'duty' | 'authorityBoundary' | 'validatorRole' | 'roleEvidence' | 'historicalRoleEvidence' | 'missingRoleEvidence'>> = {
  incidents: {
    roleId: 'director-turn-operations',
    roleName: 'Turn Operations / Director Turn Operations',
    roleStatus: 'CANONICAL_REGISTRY',
    duty: 'Monitorizează serviciile, administrează incidentele și urmărește intervențiile până la validare și arhivare.',
    authorityBoundary: 'Jurnal și intervenții Turn; nu se deduce autoritate de deploy sau infrastructură.',
    validatorRole: 'agent-inspector (validator pe rutele de incident definite)',
    roleEvidence: ['apps/web/src/agent-governance.registry.ts', 'apps/web/src/i18n/app-i18n.dictionary.ts', 'apps/web/src/incident-routing.registry.ts'],
  },
  'version-journal': {
    roleId: 'version-guardian',
    roleName: 'Version Guardian',
    roleStatus: 'CANONICAL_REGISTRY',
    duty: 'Protejează baseline-urile și înregistrează branch-uri, commituri, checkpoint-uri și deploy-uri.',
    authorityBoundary: 'Trasabilitate și baseline; nu este a doua autoritate de aprobare.',
    validatorRole: 'UNKNOWN — nu este definit un validator curent specific jurnalului în registru.',
    roleEvidence: ['apps/web/src/agent-governance.registry.ts', 'AGM_COCKPIT_GOVERNANCE_REGISTER_V1_1.md'],
  },
  memory: {
    roleId: 'agent-agm-chronicler',
    roleName: 'AGM Chronicler',
    roleStatus: 'CANONICAL_REGISTRY',
    duty: 'Păstrează cronologia proiectului, lecțiile învățate, deciziile, istoricul soluțiilor și rapoartele de stabilitate.',
    authorityBoundary: 'Istoricul validat nu poate fi rescris sau șters.',
    validatorRole: 'UNKNOWN — nu este definit un validator curent specific memoriei în registru.',
    roleEvidence: ['apps/web/src/agent-governance.registry.ts', 'apps/web/src/i18n/app-i18n.dictionary.ts', 'AGM_COCKPIT_GOVERNANCE_REGISTER_V1_1.md'],
  },
  evidence: {
    roleId: 'version-guardian',
    roleName: 'Version Guardian',
    roleStatus: 'CANONICAL_REGISTRY',
    duty: 'Protejează baseline-urile și înregistrează branch-uri, commituri, checkpoint-uri și deploy-uri.',
    authorityBoundary: 'Evidence Ledger este pentru trasabilitate; validarea independentă rămâne la Independent Validator.',
    validatorRole: 'Independent Validator / agent-inspector',
    roleEvidence: ['apps/web/src/agent-governance.registry.ts', 'AGM_COCKPIT_GOVERNANCE_REGISTER_V1_1.md', 'deploy/production/OPERATIONAL_ROLES.md'],
  },
  'risk-knowledge': {
    roleId: 'risk-knowledge-orchestrator',
    roleName: 'Risk & Knowledge Orchestrator',
    roleStatus: 'IMPLEMENTED_SOURCE',
    duty: 'Caută și corelează precedente din incidente, versiuni, snapshot-uri, surse canonice, CSC-uri și PCR-uri; produce evaluări Risk & Knowledge pentru schimbări structurale.',
    authorityBoundary: 'Poate formula BLOCK, REVIEW_REQUIRED sau ALLOW_WITH_CONDITIONS și condiții obligatorii; este advisory-only și nu modifică registrele canonice, CSC, PCR, versiuni, snapshot-uri sau dependențe.',
    validatorRole: 'VALIDATOR / Independent Validator pentru condiția de validare; nu este înlocuit de orchestrator.',
    roleEvidence: ['apps/api/src/governance-v2/risk-knowledge-orchestrator.ts', 'apps/api/src/governance-v2/governance-v2.contract.ts', 'release/turn-20261028/GOVERNANCE_V2_INTEGRATION.md', 'release/turn-20261028/GOVERNANCE_V2_VALIDATION_PACKAGE.md'],
    historicalRoleEvidence: [
      'AGM-phase1-5-boundary/.m1-final.backup · 2026-10-25 17:38:56',
      'AGM-phase1-5-boundary/.m2-final.dump · 2026-10-25 20:35:58',
      'AGM-phase1-5-boundary/.m3-governance.dump · 2026-10-25 22:18:09',
      'AGM-phase1-5-boundary/apps/api/test/risk-knowledge-orchestrator.spec.ts · tests A-L',
      'AGM-phase1-5-boundary/apps/api/scripts/execute-m1-governance-closure-controlled.ts',
      'AGM-phase1-5-boundary/apps/api/scripts/execute-m2-governance-closure-controlled.ts',
      'AGM-phase1-5-boundary/apps/api/scripts/execute-m3-governance-precondition-controlled.ts',
      'AGM-phase1-5-boundary/governance/v2/preparation/governance-v2-access-matrix.json',
    ],
    missingRoleEvidence: [
      'M4 historical artifact: NOT LOCATED; searched AGM-phase1-5-boundary dumps, governance/v2, apps/api/scripts and apps/api/test. Current Machine E2E gate is tracked separately in the release manifest.',
    ],
  },
};

const journalIds = ['incidents', 'version-journal', 'memory', 'evidence', 'risk-knowledge'] as const;

function implementationState(entry: TurnModuleNavigationEntry): ManifestLifecycleState {
  if (entry.validationStatus === 'BLOCKED') return 'BLOCKED';
  if (entry.validationStatus === 'UNKNOWN') return 'UNKNOWN';
  if (entry.validationStatus === 'VALIDATED' || entry.validationStatus === 'TESTED') return 'IMPLEMENTED';
  return 'IMPLEMENTED_NOT_VALIDATED';
}

function decisionReason(entry: TurnModuleNavigationEntry) {
  if (entry.validationStatus === 'BLOCKED') return 'NU: manifestul și registrul păstrează modulul BLOCKED; nu există dovadă de verificare curentă care să închidă blocajul.';
  if (entry.lastVerifiedAt === 'UNKNOWN') return 'NU: registrul nu are o verificare curentă pentru acest jurnal; nu se deduce PASS din existența codului sau din snapshotul manifestului.';
  return 'NU: manifestul este PREPARED_NOT_COMMITTED / NO-GO_UNTIL_COMPLETED, iar verificarea independentă și activarea Production sunt absente.';
}

function buildDecision(entry: TurnModuleNavigationEntry): ManifestJournalDecision {
  return {
    journalId: entry.moduleId,
    journal: entry.displayName,
    ...roleAssignments[entry.moduleId],
    responsible: entry.responsibleAgent,
    canonicalSource: entry.canonicalSource,
    implementation: implementationState(entry),
    verification: entry.validationStatus === 'VALIDATED' || entry.validationStatus === 'TESTED' ? 'VERIFIED' : 'NOT_VERIFIED',
    committed: 'NOT_COMMITTED',
    production: 'NOT_ACTIVE',
    decision: 'NU',
    reason: decisionReason(entry),
    evidence: [manifestPath, registryPath, checklistPath],
  };
}

/** Read-only coordination projection from the 2026-10-26/28 manifest boundary. */
export const manifestJournalDecisions: readonly ManifestJournalDecision[] = journalIds
  .map((journalId) => turnModuleNavigationRegistry.find((entry) => entry.moduleId === journalId))
  .filter((entry): entry is TurnModuleNavigationEntry => Boolean(entry))
  .map(buildDecision);

export function evaluateManifestDecision(decision: ManifestJournalDecision): ManifestDecision {
  return decision.implementation === 'IMPLEMENTED' && decision.verification === 'VERIFIED' && decision.committed === 'COMMITTED' && decision.production === 'ACTIVE' ? 'DA' : 'NU';
}

export function manifestDecisionSummary() {
  const yes = manifestJournalDecisions.filter((decision) => evaluateManifestDecision(decision) === 'DA').length;
  return { yes, no: manifestJournalDecisions.length - yes, total: manifestJournalDecisions.length };
}
