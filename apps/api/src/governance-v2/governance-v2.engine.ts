import { createHash, randomUUID } from 'node:crypto';
import type { CanonicalSourceChange, CanonicalSourceRecord, GovernanceActor, GovernanceActorRole, GovernanceDependencyEdge, GovernanceEvent, ProductionChangeRecord, SnapshotRecord, VersionRecord, IncidentRecord } from './governance-v2.contract';

export class GovernanceViolation extends Error {
  constructor(public readonly code: string, message = code) { super(message); }
}

const now = () => new Date().toISOString();
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hasRole = (actor: GovernanceActor, role: GovernanceActor['roles'][number]) => actor.roles.includes(role);

export class GovernanceV2Engine {
  private readonly sources = new Map<string, CanonicalSourceRecord>();
  private readonly cscs = new Map<string, CanonicalSourceChange>();
  private readonly pcrs = new Map<string, ProductionChangeRecord>();
  private readonly edges = new Map<string, GovernanceDependencyEdge>();
  private readonly versions = new Map<string, VersionRecord>();
  private readonly snapshots = new Map<string, SnapshotRecord>();
  private readonly incidents = new Map<string, IncidentRecord>();
  private readonly events: GovernanceEvent[] = [];

  registerCanonicalSource(input: Omit<CanonicalSourceRecord, 'createdAt' | 'updatedAt' | 'status'> & { status?: 'ACTIVE' | 'SUPERSEDED' }) {
    const active = [...this.sources.values()].find((item) => item.factKey === input.factKey && item.status === 'ACTIVE');
    if (input.status !== 'SUPERSEDED' && active) throw new GovernanceViolation('CANONICAL_SOURCE_COLLISION');
    const record: CanonicalSourceRecord = { ...input, status: input.status ?? 'ACTIVE', createdAt: now(), updatedAt: now() };
    this.sources.set(record.id, record);
    this.appendEvent('CREATED', 'CanonicalSourceRecord', record.id, input.writeAuthority, [record.id]);
    return record;
  }

  requestSourceChange(input: Omit<CanonicalSourceChange, 'status' | 'approvalStatus' | 'validationEvidence'>) {
    if (!hasRole({ id: input.proposerId, roles: ['PROPOSER'] }, 'PROPOSER')) throw new GovernanceViolation('PROPOSER_REQUIRED');
    const current = [...this.sources.values()].find((item) => item.factKey === input.factKey && item.status === 'ACTIVE');
    if (!current || current.canonicalSource !== input.oldSource || current.writeAuthority !== input.oldWriteAuthority || current.precedence !== input.oldPrecedence) throw new GovernanceViolation('OLD_SOURCE_MISMATCH');
    const csc: CanonicalSourceChange = { ...input, status: 'DRAFT', approvalStatus: 'PENDING', validationEvidence: [] };
    this.cscs.set(csc.id, csc); this.appendEvent('CREATED', 'CanonicalSourceChange', csc.id, csc.proposerId, [csc.id]); return csc;
  }

  approveSourceChange(id: string, actor: GovernanceActor) {
    const csc = this.requireCsc(id); this.requireRole(actor, 'APPROVER'); this.requireDifferent(csc.proposerId, actor.id, 'APPROVER_CANNOT_BE_PROPOSER');
    csc.approvalStatus = 'APPROVED'; csc.approvedBy = actor.id; csc.status = 'APPROVED'; this.appendEvent('APPROVED', 'CanonicalSourceChange', id, actor.id, [id]); return csc;
  }

  validateSourceChange(id: string, actor: GovernanceActor, evidence: string[]) {
    const csc = this.requireCsc(id); this.requireRole(actor, 'VALIDATOR'); this.requireDifferent(csc.proposerId, actor.id, 'VALIDATOR_CANNOT_BE_PROPOSER');
    if (csc.approvalStatus !== 'APPROVED' || evidence.length === 0) throw new GovernanceViolation('CSC_VALIDATION_INCOMPLETE');
    csc.validationEvidence = [...evidence]; csc.validatorId = actor.id; csc.status = 'VALIDATED'; this.appendEvent('VALIDATED', 'CanonicalSourceChange', id, actor.id, evidence); return csc;
  }

  activateSourceChange(id: string, actor: GovernanceActor, version: string) {
    const csc = this.requireCsc(id); this.requireRole(actor, 'EXECUTOR');
    if (csc.status !== 'VALIDATED' || !csc.approvedBy || !csc.validatorId) throw new GovernanceViolation('CSC_NOT_APPROVED_AND_VALIDATED');
    this.requireDifferent(csc.approvedBy, actor.id, 'ACTIVATOR_CANNOT_BE_APPROVER');
    const current = [...this.sources.values()].find((item) => item.factKey === csc.factKey && item.status === 'ACTIVE');
    if (!current || current.canonicalSource !== csc.oldSource) throw new GovernanceViolation('SOURCE_CHANGED_WITHOUT_CSC');
    const stamp = now(); current.status = 'SUPERSEDED'; current.supersededAt = stamp; current.supersededBy = csc.newSource; current.updatedAt = stamp;
    this.registerCanonicalSource({ id: `${csc.id}:new`, factKey: csc.factKey, humanTitle: csc.semanticTitle, description: `Activated by ${csc.id}`, canonicalSource: csc.newSource, writeAuthority: csc.newWriteAuthority, validatorAuthority: csc.validatorId, readers: current.readers, precedence: csc.newPrecedence, conflictBehavior: current.conflictBehavior, contractVersion: csc.activatedVersion ?? version, activatedAt: stamp, status: 'ACTIVE' });
    csc.activatedVersion = version; csc.activatedAt = stamp; csc.status = 'ACTIVATED'; this.appendEvent('ACTIVATED', 'CanonicalSourceChange', id, actor.id, [id]); return csc;
  }

  addDependencyEdge(edge: GovernanceDependencyEdge) { this.edges.set(edge.id, edge); return edge; }

  impactedComponents(component: string) {
    const result = new Set<string>([component]); const queue = [component];
    while (queue.length) { const current = queue.shift()!; for (const edge of this.edges.values()) if (edge.sourceComponent === current && edge.validationRequired && !result.has(edge.targetComponent)) { result.add(edge.targetComponent); queue.push(edge.targetComponent); } }
    return [...result];
  }

  registerSnapshot(snapshot: SnapshotRecord) { this.snapshots.set(snapshot.snapshotId, snapshot); return snapshot; }
  searchSnapshots(query: string) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return [...this.snapshots.values()].map((item) => ({ item, score: terms.reduce((score, term) => score + (JSON.stringify(item).toLowerCase().includes(term) ? 1 : 0), 0) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.item);
  }

  createPcr(input: Omit<ProductionChangeRecord, 'status' | 'approvalStatus' | 'dependencyChecks'>) {
    const pcr: ProductionChangeRecord = { ...input, status: 'DRAFT', approvalStatus: 'PENDING', dependencyChecks: {} }; this.pcrs.set(pcr.id, pcr); this.appendEvent('CREATED', 'ProductionChangeRecord', pcr.id, pcr.proposerId, [pcr.id]); return pcr;
  }

  assessPcr(id: string, actor: GovernanceActor) {
    const pcr = this.requirePcr(id); this.requireRole(actor, 'VALIDATOR');
    if (!pcr.impactStudy || !pcr.dependencyImpactRef || !pcr.snapshotRef || !pcr.testPlan || !pcr.rollbackPlan) throw new GovernanceViolation('IMPACT_STUDY_INCOMPLETE');
    pcr.status = 'IMPACT_ASSESSED'; this.appendEvent('VALIDATED', 'ProductionChangeRecord', id, actor.id, [pcr.impactStudy]); return pcr;
  }

  recordDependencyResult(id: string, component: string, result: ProductionChangeRecord['dependencyChecks'][string]) { const pcr = this.requirePcr(id); pcr.dependencyChecks[component] = result; return pcr; }

  approvePcr(id: string, actor: GovernanceActor) {
    const pcr = this.requirePcr(id); this.requireRole(actor, 'APPROVER'); this.requireDifferent(pcr.proposerId, actor.id, 'APPROVER_CANNOT_BE_PROPOSER');
    const required = this.impactedComponents(pcr.affectedComponents[0] ?? ''); const missing = required.filter((component) => pcr.dependencyChecks[component] === undefined);
    const bad = required.filter((component) => ['FAIL', 'UNKNOWN'].includes(pcr.dependencyChecks[component] ?? 'UNKNOWN'));
    if (missing.length || bad.length) throw new GovernanceViolation('REGRESSION_CASCADE_BLOCKED');
    pcr.approvalStatus = 'APPROVED'; pcr.approverId = actor.id; pcr.status = 'APPROVED'; this.appendEvent('APPROVED', 'ProductionChangeRecord', id, actor.id, [id]); return pcr;
  }

  deployPcr(id: string, actor: GovernanceActor, revision: string) {
    const pcr = this.requirePcr(id); this.requireRole(actor, 'EXECUTOR'); this.requireDifferent(pcr.proposerId, actor.id, 'EXECUTOR_CANNOT_BE_PROPOSER'); this.requireDifferent(pcr.approverId, actor.id, 'EXECUTOR_CANNOT_BE_APPROVER');
    if (pcr.status !== 'APPROVED') throw new GovernanceViolation('PCR_NOT_APPROVED'); pcr.executorId = actor.id; pcr.deployRevision = revision; pcr.status = 'DEPLOYED'; this.appendEvent('ACTIVATED', 'ProductionChangeRecord', id, actor.id, [revision]); return pcr;
  }

  validatePcr(id: string, actor: GovernanceActor, evidence: string[], verdict: 'PASS' | 'FAIL') {
    const pcr = this.requirePcr(id); this.requireRole(actor, 'VALIDATOR'); this.requireDifferent(pcr.proposerId, actor.id, 'VALIDATOR_CANNOT_BE_PROPOSER'); this.requireDifferent(pcr.executorId, actor.id, 'VALIDATOR_CANNOT_BE_EXECUTOR');
    if (pcr.status !== 'DEPLOYED' || !evidence.length) throw new GovernanceViolation('POST_DEPLOY_VALIDATION_INCOMPLETE'); pcr.validatorId = actor.id; pcr.postDeployVerification = evidence.join(','); pcr.finalVerdict = verdict; pcr.status = verdict === 'PASS' ? 'CLOSED' : 'FAILED_VALIDATION'; this.appendEvent('CLOSES', 'ProductionChangeRecord', id, actor.id, evidence); return pcr;
  }

  registerVersion(version: VersionRecord) { this.versions.set(version.id, version); return version; }
  promoteVersion(id: string, target: VersionRecord['status']) {
    const version = this.versions.get(id); if (!version) throw new GovernanceViolation('VERSION_NOT_FOUND');
    const valid: Record<string, VersionRecord['status'][]> = { CANDIDATE: ['WIP'], VALIDATED: ['CANDIDATE'], CANONICAL: ['VALIDATED'], DEPLOYED: ['CANONICAL'] };
    if (valid[target] && !valid[target].includes(version.status)) throw new GovernanceViolation('INVALID_VERSION_PROMOTION');
    if (target === 'DEPLOYED' && (!version.pcrRefs.length || !version.validationEvidence.length)) throw new GovernanceViolation('DEPLOYMENT_PROVENANCE_INCOMPLETE'); version.status = target; return version;
  }

  registerIncident(incident: IncidentRecord) { this.incidents.set(incident.id, incident); return incident; }
  appendEvent(eventType: GovernanceEvent['eventType'], entityType: string, entityId: string, actorId: string, evidenceRefs: string[] = []) {
    const previous = this.events.at(-1); const event: GovernanceEvent = { eventId: randomUUID(), eventType, semanticTitle: `${eventType} ${entityType}`, entityType, entityId, payloadDigest: digest({ eventType, entityType, entityId, evidenceRefs }), correlationId: randomUUID(), actorId, occurredAt: now(), recordedAt: now(), evidenceRefs, previousEventId: previous?.eventId, previousDigest: previous?.payloadDigest };
    this.events.push(event); return event;
  }
  getEvents() { return [...this.events]; }
  mutateEvent() { throw new GovernanceViolation('EVENT_LEDGER_APPEND_ONLY'); }

  private requireCsc(id: string) { const item = this.cscs.get(id); if (!item) throw new GovernanceViolation('CSC_NOT_FOUND'); return item; }
  private requirePcr(id: string) { const item = this.pcrs.get(id); if (!item) throw new GovernanceViolation('PCR_NOT_FOUND'); return item; }
  private requireRole(actor: GovernanceActor, role: GovernanceActorRole) { if (!hasRole(actor, role)) throw new GovernanceViolation(`${role}_REQUIRED`); }
  private requireDifferent(left: string | undefined, right: string, code: string) { if (left && left === right) throw new GovernanceViolation(code); }
}
