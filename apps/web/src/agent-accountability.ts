import { agentGovernanceRegistry } from './agent-governance.registry';
import type { OperationService, OperationSnapshot } from './operations-health';

export type DutyFreshness = 'CURRENT' | 'STALE' | 'UNKNOWN';
export type DutyResult = 'PASS' | 'FAIL' | 'UNKNOWN';
export type DutyState = 'DUTY VERIFIED' | 'FAILED' | 'ROLE DRIFT' | 'UNKNOWN / NO CURRENT EVIDENCE';

export type AgentRoleContract = {
  agentId: string;
  roleContractVersion: string;
  role: string;
  requiredDuties: string[];
  forbiddenDuties: string[];
  triggers: string[];
  expectedOutput: string;
  validator: string;
  escalationRules: string[];
  stopConditions: string[];
  freshnessMs: number;
};

export type DutyExecutionReceipt = {
  agentId: string;
  roleContractVersion: string;
  mandateId: string;
  changeId?: string;
  trigger: string;
  startedAt: string;
  completedAt: string;
  source: string[];
  coverage: string;
  result: DutyResult;
  evidenceRef: string;
  freshness: DutyFreshness;
  openResponsibility: string;
  escalation: string;
  validator: string;
  independence?: string;
  executedActions?: string[];
};

export const agentIdentityAliases = Object.freeze({
  'architecture-inspector': 'architecture-guardian',
  'version-custodian': 'version-guardian',
  mentor: 'agent-mentor',
  'adrian-turn-commander': 'turn-commander-adrian',
} as const);

export function canonicalAgentId(agentId: string) {
  return agentIdentityAliases[agentId as keyof typeof agentIdentityAliases] ?? agentId;
}

const monitorSourceToAgent = Object.freeze({
  'server-primary': 'monitor-server-primary',
  'server-backup': 'monitor-server-backup',
  api: 'monitor-api',
  browser: 'monitor-browser',
  android: 'monitor-android',
  ai: 'monitor-ai',
  databases: 'monitor-database',
  'cloudflare-public': 'monitor-cloudflare',
  'ui-live': 'monitor-ui-live',
  telemetry: 'monitor-telemetry',
  security: 'monitor-security',
} as const);

const monitorForbiddenDuties = [
  'restart services',
  'rotate credentials',
  'modify DNS',
  'remediate infrastructure',
  'execute the operation being monitored',
];

const contractOverrides: Record<string, Partial<AgentRoleContract>> = {
  'turn-commander-adrian': {
    role: 'Product Owner / Turn Commander', requiredDuties: ['issue material decisions and mandates', 'accept or close the authorized scope'],
    forbiddenDuties: ['replace independent QA', 'replace the Inspector', 'execute technical remediation as validator'], triggers: ['MATERIAL_DECISION_REQUIRED'],
    expectedOutput: 'Versioned decision or mandate record.', validator: 'agm-governance-audit',
  },
  'atlas-operations': {
    role: 'Operational Coordination', requiredDuties: ['coordinate in-scope execution through validation and closure'],
    forbiddenDuties: ['invent Owner approvals', 'self-validate independent gates', 'stop at an intermediate build PASS'], triggers: ['EXPLICIT_MANDATE'],
    expectedOutput: 'Execution plan, handoffs, evidence index and closure report.', validator: 'agent-inspector',
  },
  'chief-monitoring-inspector': {
    role: 'Chief Monitoring Inspector', requiredDuties: ['independently correlate monitor receipts', 'detect missing checks and role drift', 'escalate verified incidents'],
    forbiddenDuties: ['execute monitored remediation', 'validate own operational action', 'infer health from registration'], triggers: ['MONITOR_RECEIPT', 'INCIDENT_TRUTH', 'ROLE_DRIFT'],
    expectedOutput: 'Independent monitoring verdict with coverage and escalation.', validator: 'turn-commander-adrian',
  },
  rescue: {
    role: 'Rescue Recovery Agent', requiredDuties: ['exhaust authorized recovery paths before HOLD', 'preserve accepted PASS evidence', 'run only the affected minimal retest'],
    forbiddenDuties: ['repeat an unchanged failed attempt', 'install speculative dependencies', 'broaden Production scope'], triggers: ['TECHNICAL_BLOCKER_BEFORE_HOLD'],
    expectedOutput: 'Recovery journal and handback to Atlas.', validator: 'agent-inspector',
  },
  'agm-central-librarian': {
    role: 'AGM Central Librarian', requiredDuties: ['index and hash authorized collections', 'report duplicates, missing items and conflicts'],
    forbiddenDuties: ['modify product/runtime', 'resolve conflicts autonomously', 'promote missing evidence to PASS'], triggers: ['LIBRARY_COLLECTION_MANDATE'],
    expectedOutput: 'Versioned index and integrity report.', validator: 'agent-inspector',
  },
  'p3-safe-observer': {
    role: 'P3 dossier-scoped safe observer', requiredDuties: ['perform read-only observation within the admitted dossier'],
    forbiddenDuties: ['persist as an active worker outside a lease', 'write domain state', 'expand tenant scope'], triggers: ['P3_ADMISSION'],
    expectedOutput: 'Dossier-scoped observation evidence.', validator: 'agent-inspector',
  },
  'architecture-guardian': {
    role: 'Architecture Guardian',
    requiredDuties: ['verify boundaries and contracts', 'verify reusable foundations', 'issue architecture PASS or NO-GO'],
    forbiddenDuties: ['implement the reviewed change', 'validate own implementation', 'invent gates without active authority'],
    triggers: ['NEW_FUNCTION', 'MATERIAL_EXTENSION', 'NEW_CONTRACT', 'NEW_DEPENDENCY', 'ARCHITECTURE_CHANGE'],
    expectedOutput: 'Versioned architecture review with reuse decision and PASS/NO-GO.',
    validator: 'agent-inspector',
  },
  'version-guardian': {
    role: 'Version Guardian',
    requiredDuties: ['record commit, tag, artifact, checksum and baseline identity'],
    forbiddenDuties: ['approve functional content', 'promote an unfrozen source tree'],
    triggers: ['CHECKPOINT', 'RELEASE_CANDIDATE', 'DEPLOYMENT'],
    expectedOutput: 'Immutable version and provenance manifest.',
    validator: 'agent-inspector',
  },
  'agent-mentor': {
    role: 'Strategic Mentor',
    requiredDuties: ['evaluate material product direction and Basic/Premium separation'],
    forbiddenDuties: ['execute technical remediation', 'create procedural approval gates'],
    triggers: ['MATERIAL_STRATEGIC_DECISION'],
    expectedOutput: 'Strategic recommendation or decision input.',
    validator: 'turn-commander-adrian',
  },
  'agent-inspector': {
    role: 'Independent Chief Inspector',
    requiredDuties: ['inspect evidence independently', 'identify contradictions', 'issue verdict and recommendations'],
    forbiddenDuties: ['implement the remediation under review', 'turn a recommendation into a mandate', 'reuse historical recommendations as current state'],
    triggers: ['INSPECTION_MANDATE', 'VALIDATION_GATE'],
    expectedOutput: 'Signed inspection report, verdict and evidence references.',
    validator: 'turn-commander-adrian',
  },
  'release-operations': {
    role: 'Release & Operations',
    requiredDuties: ['build, deploy, recover and rollback within mandate', 'record environment and rollback evidence'],
    forbiddenDuties: ['issue independent QA verdict', 'escalate routine retry, restart, redeploy or authorized rollback to Owner'],
    triggers: ['RELEASE', 'DEPLOYMENT', 'RECOVERY', 'AUTHORIZED_ROLLBACK'],
    expectedOutput: 'Release receipt, rollback point and post-deploy validation.',
    validator: 'agent-inspector',
  },
  'monitor-incidents': {
    role: 'MON-010 Incident Truth Monitor',
    requiredDuties: ['check every applicable incident source', 'report incident truth with coverage and freshness'],
    forbiddenDuties: [...monitorForbiddenDuties, 'default an unchecked result to zero incidents', 'validate or close its own remediation'],
    triggers: ['TURN_OPEN', 'INCIDENT_EVENT', 'PERIODIC_CHECK', 'MANUAL_RECHECK'],
    expectedOutput: 'Incident truth receipt: ACTIVE, NO ACTIVE, UNKNOWN/NOT CHECKED or DATA UNAVAILABLE.',
    validator: 'chief-monitoring-inspector',
  },
};

function defaultRoleContract(agentId: string): AgentRoleContract {
  const record = agentGovernanceRegistry.find((entry) => canonicalAgentId(entry.id) === agentId);
  const monitor = agentId.startsWith('monitor-');
  return {
    agentId,
    roleContractVersion: 'agm-agent-role.v1.1',
    role: record?.displayRole ?? record?.code ?? agentId,
    requiredDuties: [record?.displayResponsibilities ?? `Execute the declared ${agentId} responsibility.`],
    forbiddenDuties: monitor
      ? [...monitorForbiddenDuties]
      : ['operate outside an approved mandate', 'self-validate when independence is required', 'represent identity as execution evidence'],
    triggers: monitor ? ['PERIODIC_CHECK', 'EVENT', 'MANUAL_RECHECK'] : ['EXPLICIT_MANDATE'],
    expectedOutput: monitor ? 'Timestamped monitoring receipt with source, coverage, result and escalation.' : 'Versioned duty receipt with evidence.',
    validator: agentId === 'agent-inspector' ? 'turn-commander-adrian' : 'agent-inspector',
    escalationRules: ['Escalate to the responsible executor; request Owner only for a new material decision.'],
    stopConditions: ['scope exceeded', 'material new risk', 'unsafe mixed origin', 'secret or data exposure', 'validator not independent'],
    freshnessMs: monitor ? 90_000 : 86_400_000,
  };
}

const canonicalRegistryIds = [...new Set([
  ...agentGovernanceRegistry.map((entry) => canonicalAgentId(entry.id)),
  'turn-commander-adrian', 'atlas-operations', 'chief-monitoring-inspector',
  'rescue', 'agm-central-librarian', 'p3-safe-observer',
])];
export const agentRoleContracts: AgentRoleContract[] = canonicalRegistryIds.map((agentId) => ({
  ...defaultRoleContract(agentId),
  ...(contractOverrides[agentId] ?? {}),
}));

export function roleContractFor(agentId: string) {
  return agentRoleContracts.find((contract) => contract.agentId === canonicalAgentId(agentId));
}

export function validateRoleContract(contract: AgentRoleContract) {
  const missing = (['agentId', 'roleContractVersion', 'role', 'expectedOutput', 'validator'] as const)
    .filter((field) => !contract[field]);
  if (!contract.requiredDuties.length) missing.push('requiredDuties' as never);
  if (!contract.forbiddenDuties.length) missing.push('forbiddenDuties' as never);
  if (!contract.triggers.length) missing.push('triggers' as never);
  if (!contract.escalationRules.length) missing.push('escalationRules' as never);
  if (!contract.stopConditions.length) missing.push('stopConditions' as never);
  return missing;
}

export function validateDutyReceipt(receipt: DutyExecutionReceipt) {
  const missing: string[] = [];
  const requiredStrings: Array<keyof DutyExecutionReceipt> = [
    'agentId', 'roleContractVersion', 'mandateId', 'trigger', 'startedAt', 'completedAt',
    'coverage', 'result', 'evidenceRef', 'freshness', 'openResponsibility', 'escalation', 'validator',
  ];
  for (const field of requiredStrings) if (!String(receipt[field] ?? '').trim()) missing.push(field);
  if (!receipt.source.length) missing.push('source');
  if (Number.isNaN(Date.parse(receipt.startedAt))) missing.push('startedAt:invalid');
  if (Number.isNaN(Date.parse(receipt.completedAt))) missing.push('completedAt:invalid');
  return missing;
}

export function detectRoleDrift(receipt: DutyExecutionReceipt) {
  const contract = roleContractFor(receipt.agentId);
  const reasons: string[] = [];
  if (!contract) return ['ROLE_CONTRACT_NOT_FOUND'];
  if (canonicalAgentId(receipt.agentId) !== receipt.agentId) reasons.push('NON_CANONICAL_RECEIPT_ID');
  if (receipt.roleContractVersion !== contract.roleContractVersion) reasons.push('STALE_ROLE_CONTRACT');
  if (!contract.triggers.includes(receipt.trigger)) reasons.push('UNAUTHORIZED_TRIGGER');
  if (receipt.result === 'PASS' && !receipt.evidenceRef.trim()) reasons.push('PASS_WITHOUT_EVIDENCE');
  for (const action of receipt.executedActions ?? []) {
    if (contract.forbiddenDuties.some((forbidden) => action.toLocaleLowerCase().includes(forbidden.toLocaleLowerCase()))) {
      reasons.push(`FORBIDDEN_ACTION:${action}`);
    }
  }
  if (receipt.independence === 'REQUIRED' && canonicalAgentId(receipt.validator) === contract.agentId) reasons.push('VALIDATOR_NOT_INDEPENDENT');
  return reasons;
}
export function authorizeDutyExecution(agentId: string, trigger: string, plannedActions: string[] = []) {
  const contract = roleContractFor(agentId);
  if (!contract) throw new Error(`ROLE_CONTRACT_NOT_FOUND:${agentId}`);
  const violations: string[] = [];
  if (!contract.triggers.includes(trigger)) violations.push(`UNAUTHORIZED_TRIGGER:${trigger}`);
  for (const action of plannedActions) {
    const forbidden = contract.forbiddenDuties.find((duty) => action.toLocaleLowerCase().includes(duty.toLocaleLowerCase()));
    if (forbidden) violations.push(`FORBIDDEN_ACTION:${action}`);
  }
  if (violations.length) throw new Error(`ROLE_DRIFT_BLOCKED:${canonicalAgentId(agentId)}:${violations.join(',')}`);
  return contract;
}


export function dutyState(receipt: DutyExecutionReceipt | undefined, now = new Date()): DutyState {
  if (!receipt || validateDutyReceipt(receipt).length) return 'UNKNOWN / NO CURRENT EVIDENCE';
  if (detectRoleDrift(receipt).length) return 'ROLE DRIFT';
  if (receipt.result === 'FAIL') return 'FAILED';
  const contract = roleContractFor(receipt.agentId);
  if (!contract || receipt.freshness !== 'CURRENT' || now.getTime() - Date.parse(receipt.completedAt) > contract.freshnessMs) return 'UNKNOWN / NO CURRENT EVIDENCE';
  return receipt.result === 'PASS' ? 'DUTY VERIFIED' : 'UNKNOWN / NO CURRENT EVIDENCE';
}

const receiptStorageKey = 'agm.turn.duty-receipts.v1.1';
const memoryReceipts: DutyExecutionReceipt[] = [];
let accountabilityViewBound = false;

function storageOrUndefined(storage?: Storage) {
  if (storage) return storage;
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function readDutyReceipts(storage?: Storage) {
  const target = storageOrUndefined(storage);
  if (!target) return [...memoryReceipts];
  try {
    const parsed = JSON.parse(target.getItem(receiptStorageKey) ?? '[]') as DutyExecutionReceipt[];
    return Array.isArray(parsed) ? parsed.filter((receipt) => !validateDutyReceipt(receipt).length) : [];
  } catch {
    return [];
  }
}

export function recordDutyReceipt(receipt: DutyExecutionReceipt, storage?: Storage) {
  if (validateDutyReceipt(receipt).length) throw new Error('DUTY_RECEIPT_INVALID');
  const normalized = { ...receipt, agentId: canonicalAgentId(receipt.agentId) };
  const target = storageOrUndefined(storage);
  const receipts = target ? readDutyReceipts(target) : memoryReceipts;
  const next = [...receipts.filter((item) => !(item.agentId === normalized.agentId && item.mandateId === normalized.mandateId && item.completedAt === normalized.completedAt)), normalized]
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
    .slice(-500);
  if (target) target.setItem(receiptStorageKey, JSON.stringify(next));
  else memoryReceipts.splice(0, memoryReceipts.length, ...next);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('agm:duty-receipt', { detail: normalized }));
  return normalized;
}

export function latestDutyReceipt(agentId: string, storage?: Storage) {
  const canonicalId = canonicalAgentId(agentId);
  return readDutyReceipts(storage).filter((receipt) => receipt.agentId === canonicalId).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
}

export function recordMonitoringDuty(source: OperationService, snapshot: OperationSnapshot, storage?: Storage) {
  const agentId = monitorSourceToAgent[source.id as keyof typeof monitorSourceToAgent];
  if (!agentId) return undefined;
  const contract = roleContractFor(agentId)!;
  const successful = snapshot.status === 'ONLINE' || snapshot.status === 'READY';
  const failed = snapshot.status === 'OFFLINE' || snapshot.status === 'DEGRADED';
  authorizeDutyExecution(agentId, 'PERIODIC_CHECK', ['observe', 'verify', 'record', ...(failed ? ['escalate'] : [])]);
  return recordDutyReceipt({
    agentId,
    roleContractVersion: contract.roleContractVersion,
    mandateId: `monitor:${source.id}:${snapshot.checkedAt.toISOString()}`,
    trigger: 'PERIODIC_CHECK',
    startedAt: snapshot.checkedAt.toISOString(),
    completedAt: snapshot.checkedAt.toISOString(),
    source: [source.source],
    coverage: source.id,
    result: successful ? 'PASS' : failed ? 'FAIL' : 'UNKNOWN',
    evidenceRef: `runtime:operations-health:${source.id}:${snapshot.checkedAt.toISOString()}`,
    freshness: snapshot.freshness === 'LIVE' || snapshot.freshness === 'OFFLINE' ? 'CURRENT' : snapshot.freshness === 'STALE' ? 'STALE' : 'UNKNOWN',
    openResponsibility: failed ? `Escalate ${source.id} failure to the competent executor.` : 'NONE',
    escalation: failed ? 'REQUIRED' : 'NONE',
    validator: 'chief-monitoring-inspector',
    executedActions: ['observe', 'verify', 'record', ...(failed ? ['escalate'] : [])],
  }, storage);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function accountabilityRows() {
  return agentRoleContracts.map((contract) => {
    const receipt = latestDutyReceipt(contract.agentId);
    const state = dutyState(receipt);
    const drift = receipt ? detectRoleDrift(receipt) : [];
    return `<tr data-accountability-agent="${escapeHtml(contract.agentId)}" data-duty-state="${escapeHtml(state)}"><td><code>${escapeHtml(contract.agentId)}</code></td><td>${escapeHtml(contract.role)}</td><td>${escapeHtml(contract.requiredDuties.join('; '))}</td><td>${escapeHtml(contract.triggers.join(', '))}</td><td>${receipt ? escapeHtml(new Date(receipt.completedAt).toLocaleString()) : 'NO CURRENT EVIDENCE'}</td><td>${receipt ? escapeHtml(receipt.result) : 'UNKNOWN'}</td><td>${receipt ? escapeHtml(`${receipt.source.join(', ')} · ${receipt.coverage}`) : 'NO CURRENT EVIDENCE'}</td><td>${receipt ? escapeHtml(receipt.freshness) : 'UNKNOWN'}</td><td><strong>${escapeHtml(state)}</strong></td><td>${receipt ? escapeHtml(receipt.openResponsibility) : 'Duty execution not demonstrated.'}</td><td>${receipt ? escapeHtml(receipt.escalation) : 'NONE'}</td><td>${drift.length ? escapeHtml(drift.join(', ')) : 'NONE DETECTED'}</td></tr>`;
  }).join('');
}

export function renderAgentAccountabilityView() {
  return `<section class="turn-agent-accountability" id="turn-agent-accountability" aria-labelledby="turn-agent-accountability-title"><header><div><span class="turn-kicker">TURN · DUTY EXECUTION TRUTH</span><h2 id="turn-agent-accountability-title">Agent Role Accountability</h2><p>Identitatea nu este execuție. Fără receipt curent, starea este UNKNOWN / NO CURRENT EVIDENCE.</p></div><span class="protocol-status">ROLE CONTRACT v1.1 · ENFORCED</span></header><div class="turn-accountability-table-wrap"><table><thead><tr><th>Agent</th><th>Role</th><th>Expected duty</th><th>Trigger</th><th>Last execution</th><th>Last result</th><th>Source / coverage</th><th>Freshness</th><th>Current state</th><th>Open responsibility</th><th>Escalation</th><th>Role drift</th></tr></thead><tbody data-accountability-rows>${accountabilityRows()}</tbody></table></div></section>`;
}

export function bindAgentAccountabilityView() {
  const refresh = () => {
    const body = document.querySelector<HTMLElement>('[data-accountability-rows]');
    if (body) body.innerHTML = accountabilityRows();
  };
  if (!accountabilityViewBound) {
    window.addEventListener('agm:duty-receipt', refresh);
    accountabilityViewBound = true;
  }
  refresh();
}
