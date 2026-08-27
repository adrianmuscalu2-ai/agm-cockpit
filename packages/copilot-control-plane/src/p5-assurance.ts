import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { DossierRevision, VerdictRecord } from './p4-knowledge';

export type AssuranceIdentity = { principalId: string; workloadId: string; role: 'ATLAS_APPROVER' | 'FINAL_INSPECTOR' | 'OWNER_ADMIN'; controlDomain: string };
export type AssuranceStatus = 'KNOWLEDGE_GATE_READY' | 'ATLAS_REVIEW' | 'ATLAS_OK' | 'FINAL_INSPECTION' | 'REWORK_REQUIRED' | 'APPROVED_FOR_ARCHIVE' | 'OWNER_REVIEW';
export type KnowledgeGateAggregationReceipt = { receiptId: string; dossierId: string; tenantId: string; sourceRevision: number; sourceRevisionHash: string; sourceContentHash: string; sourceEvidenceHash: string; sourcePolicySnapshotHash: string; requiredReviewSetHash: string; consumedVerdictsHash: string; consumedVerdictIds: string[]; validatorIdentityHash: string; aggregationResult: 'KNOWLEDGE_GATE_READY'; targetRevision: number; targetRevisionHash: string; targetContentHash: string; targetEvidenceHash: string; targetPolicySnapshotHash: string; issuedAt: string; nonce: string; signatureKeyId: string; signature: string };
export type AtlasAttestation = { attestationId: string; dossierId: string; revision: number; revisionHash: string; evidenceHash: string; policySnapshotHash: string; reviewSetHash: string; atlasPrincipalId: string; atlasWorkloadId: string; issuedAt: string; expiresAt: string; result: 'ATLAS_OK' | 'REWORK_REQUIRED'; reasonCode: string; nonce: string; signatureKeyId: string; signature: string };
export type FinalInspection = { inspectionId: string; dossierId: string; revision: number; revisionHash: string; evidenceHash: string; policySnapshotHash: string; atlasAttestationHash: string; inspectorPrincipalId: string; inspectorWorkloadId: string; issuedAt: string; result: 'APPROVED_FOR_ARCHIVE' | 'REWORK_REQUIRED'; reasonCode: string; nonce: string; signatureKeyId: string; signature: string };
export type AssuranceEvent = { eventId: string; dossierId: string; tenantId: string; status: AssuranceStatus; occurredAt: string; revision: number; revisionHash: string; actorRole: string; chainHash: string };

export class RoleSigner {
  constructor(readonly keyId: string, private readonly key: Buffer) { if (key.length < 32) throw new Error('KEY_TOO_SHORT'); }
  sign(value: object) { return createHmac('sha256', this.key).update(stable(value)).digest('hex'); }
  verify(value: object, signature: string) { const expected = Buffer.from(this.sign(value), 'hex'); const supplied = Buffer.from(signature, 'hex'); return expected.length === supplied.length && timingSafeEqual(expected, supplied); }
}

export class KnowledgeGateAggregationAuthority {
  readonly #usedReceiptIds = new Set<string>(); readonly #usedNonces = new Set<string>();
  constructor(private readonly signer: RoleSigner) {}
  issue(input: { receiptId: string; nonce: string; source: DossierRevision; target: DossierRevision; verdicts: VerdictRecord[]; issuedAt: string }) {
    if (this.#usedReceiptIds.has(input.receiptId) || this.#usedNonces.has(input.nonce)) throw new Error('AGGREGATION_REPLAY');
    if (input.source.dossierId !== input.target.dossierId || input.source.tenantId !== input.target.tenantId || input.source.revision !== input.target.revision) throw new Error('STALE_SOURCE_REVISION');
    if (input.source.status !== 'DOMAIN_VALIDATION' || input.target.status !== 'KNOWLEDGE_GATE_READY') throw new Error('INVALID_AGGREGATION_STATES');
    if (!input.source.contentHash || !input.source.evidenceHash || !input.source.policy.snapshotHash || !input.source.revisionHash || !input.target.revisionHash) throw new Error('SOURCE_HASH_MISSING');
    if (input.source.contentHash !== input.target.contentHash || input.source.evidenceHash !== input.target.evidenceHash || input.source.policy.snapshotHash !== input.target.policy.snapshotHash) throw new Error('AGGREGATION_CONTENT_POLICY_MISMATCH');
    const required = input.source.policy.requiredReviews;
    const consumed = input.verdicts.filter((item) => item.dossierId === input.source.dossierId && item.revision === input.source.revision);
    if (!required.every((domain) => consumed.some((item) => item.domain === domain && item.verdict === 'PASS'))) throw new Error('AGGREGATION_REQUIRED_REVIEW_MISSING');
    if (consumed.some((item) => item.revisionHash !== input.source.revisionHash || item.evidenceHash !== input.source.evidenceHash)) throw new Error('ALTERED_OR_STALE_VERDICT');
    if (new Set(consumed.map((item) => item.verdictId)).size !== consumed.length) throw new Error('DUPLICATE_VERDICT');
    const validatorPairs = consumed.map((item) => `${item.reviewerId}:${item.reviewerWorkloadId}`).sort();
    if (validatorPairs.some((pair, index) => pair === validatorPairs[index - 1])) throw new Error('FORGED_OR_DUPLICATE_VALIDATOR_IDENTITY');
    const verdictBindings = consumed.map((item) => ({ verdictId: item.verdictId, verdictHash: item.verdictHash, reviewerId: item.reviewerId, reviewerWorkloadId: item.reviewerWorkloadId, domain: item.domain, verdict: item.verdict })).sort((a, b) => a.verdictId.localeCompare(b.verdictId));
    const unsigned = { receiptId: input.receiptId, dossierId: input.source.dossierId, tenantId: input.source.tenantId, sourceRevision: input.source.revision, sourceRevisionHash: input.source.revisionHash, sourceContentHash: input.source.contentHash, sourceEvidenceHash: input.source.evidenceHash, sourcePolicySnapshotHash: input.source.policy.snapshotHash, requiredReviewSetHash: digest(stable(required)), consumedVerdictsHash: digest(stable(verdictBindings)), consumedVerdictIds: verdictBindings.map((item) => item.verdictId), validatorIdentityHash: digest(stable(validatorPairs)), aggregationResult: 'KNOWLEDGE_GATE_READY' as const, targetRevision: input.target.revision, targetRevisionHash: input.target.revisionHash, targetContentHash: input.target.contentHash, targetEvidenceHash: input.target.evidenceHash, targetPolicySnapshotHash: input.target.policy.snapshotHash, issuedAt: input.issuedAt, nonce: input.nonce, signatureKeyId: this.signer.keyId };
    const receipt = Object.freeze({ ...unsigned, consumedVerdictIds: Object.freeze([...unsigned.consumedVerdictIds]) as unknown as string[], signature: this.signer.sign(unsigned) }); this.#usedReceiptIds.add(input.receiptId); this.#usedNonces.add(input.nonce); return { ...receipt, consumedVerdictIds: [...receipt.consumedVerdictIds] };
  }
  verify(receipt: KnowledgeGateAggregationReceipt, target: DossierRevision, verdicts: VerdictRecord[]) {
    const { signature, ...unsigned } = receipt; if (receipt.signatureKeyId !== this.signer.keyId || !this.signer.verify(unsigned, signature)) return { valid: false, reason: 'FORGED_AGGREGATION_RECEIPT' } as const;
    if (receipt.dossierId !== target.dossierId || receipt.tenantId !== target.tenantId || receipt.targetRevision !== target.revision || receipt.targetRevisionHash !== target.revisionHash || receipt.targetContentHash !== target.contentHash || receipt.targetEvidenceHash !== target.evidenceHash || receipt.targetPolicySnapshotHash !== target.policy.snapshotHash) return { valid: false, reason: 'TARGET_BINDING_MISMATCH' } as const;
    const consumed = verdicts.filter((item) => receipt.consumedVerdictIds.includes(item.verdictId)); const bindings = consumed.map((item) => ({ verdictId: item.verdictId, verdictHash: item.verdictHash, reviewerId: item.reviewerId, reviewerWorkloadId: item.reviewerWorkloadId, domain: item.domain, verdict: item.verdict })).sort((a, b) => a.verdictId.localeCompare(b.verdictId));
    if (consumed.length !== receipt.consumedVerdictIds.length || digest(stable(bindings)) !== receipt.consumedVerdictsHash) return { valid: false, reason: 'VERDICT_BINDING_MISMATCH' } as const;
    return { valid: true, reason: 'AGGREGATION_RECEIPT_VALID' } as const;
  }
}

export class AtlasCompletenessAuthority {
  readonly #usedIds = new Set<string>();
  constructor(private readonly signer: RoleSigner, private readonly ttlMs: number, private readonly aggregation: KnowledgeGateAggregationAuthority) {}
  review(input: { identity: AssuranceIdentity; dossier: DossierRevision; verdicts: VerdictRecord[]; aggregationReceipt: KnowledgeGateAggregationReceipt; attestationId: string; nonce: string; now: string; result?: 'ATLAS_OK' | 'REWORK_REQUIRED'; reasonCode?: string }) {
    if (input.identity.role !== 'ATLAS_APPROVER') throw new Error('ATLAS_ROLE_REQUIRED'); if (this.#usedIds.has(input.attestationId)) throw new Error('DUPLICATE_ATTESTATION');
    enforceDistinct(input.dossier, input.verdicts, input.identity, undefined);
    if (input.dossier.status !== 'KNOWLEDGE_GATE_READY') throw new Error('KNOWLEDGE_GATE_NOT_READY');
    const receiptValidation = this.aggregation.verify(input.aggregationReceipt, input.dossier, input.verdicts); if (!receiptValidation.valid) throw new Error(receiptValidation.reason);
    const required = input.dossier.policy.requiredReviews; const complete = input.aggregationReceipt.requiredReviewSetHash === digest(stable(required));
    const result = input.result ?? (complete ? 'ATLAS_OK' : 'REWORK_REQUIRED'); if (result === 'ATLAS_OK' && !complete) throw new Error('ATLAS_CANNOT_WAIVE_MISSING_REVIEW');
    const unsigned = { attestationId: input.attestationId, dossierId: input.dossier.dossierId, revision: input.dossier.revision, revisionHash: input.dossier.revisionHash, evidenceHash: input.dossier.evidenceHash, policySnapshotHash: input.dossier.policy.snapshotHash, reviewSetHash: input.aggregationReceipt.requiredReviewSetHash, atlasPrincipalId: input.identity.principalId, atlasWorkloadId: input.identity.workloadId, issuedAt: input.now, expiresAt: new Date(Date.parse(input.now) + this.ttlMs).toISOString(), result, reasonCode: input.reasonCode ?? (complete ? 'COMPLETE_ROUTE' : 'INCOMPLETE_ROUTE'), nonce: input.nonce, signatureKeyId: this.signer.keyId };
    const attestation = Object.freeze({ ...unsigned, signature: this.signer.sign(unsigned) }); this.#usedIds.add(input.attestationId); return { ...attestation };
  }
  verify(value: AtlasAttestation) { const { signature, ...unsigned } = value; return value.signatureKeyId === this.signer.keyId && this.signer.verify(unsigned, signature); }
}

export class FinalKnowledgeInspectorAuthority {
  readonly #usedIds = new Set<string>(); readonly #consumedAtlas = new Set<string>();
  constructor(private readonly signer: RoleSigner, private readonly atlas: AtlasCompletenessAuthority) {}
  inspect(input: { identity: AssuranceIdentity; dossier: DossierRevision; verdicts: VerdictRecord[]; attestation: AtlasAttestation; inspectionId: string; nonce: string; now: string; result: 'APPROVED_FOR_ARCHIVE' | 'REWORK_REQUIRED'; reasonCode: string }) {
    if (input.identity.role !== 'FINAL_INSPECTOR') throw new Error('FINAL_INSPECTOR_ROLE_REQUIRED'); if (this.#usedIds.has(input.inspectionId)) throw new Error('DUPLICATE_INSPECTION');
    enforceDistinct(input.dossier, input.verdicts, { principalId: input.attestation.atlasPrincipalId, workloadId: input.attestation.atlasWorkloadId, role: 'ATLAS_APPROVER', controlDomain: 'atlas-bound' }, input.identity);
    if (!this.atlas.verify(input.attestation)) throw new Error('FORGED_ATLAS_ATTESTATION'); if (input.attestation.result !== 'ATLAS_OK') throw new Error('ATLAS_OK_REQUIRED'); if (Date.parse(input.now) >= Date.parse(input.attestation.expiresAt)) throw new Error('STALE_ATLAS_OK');
    if (this.#consumedAtlas.has(input.attestation.attestationId)) throw new Error('ATLAS_ATTESTATION_REPLAY');
    if (input.dossier.status !== 'KNOWLEDGE_GATE_READY' || input.dossier.revision !== input.attestation.revision || input.dossier.revisionHash !== input.attestation.revisionHash || input.dossier.evidenceHash !== input.attestation.evidenceHash || input.dossier.policy.snapshotHash !== input.attestation.policySnapshotHash) throw new Error('DOSSIER_ATTESTATION_BINDING_MISMATCH');
    const contradiction = hasContradiction(input.verdicts, input.dossier.revision); if (input.result === 'APPROVED_FOR_ARCHIVE' && contradiction) throw new Error('CONTRADICTION_REQUIRES_REWORK');
    const unsigned = { inspectionId: input.inspectionId, dossierId: input.dossier.dossierId, revision: input.dossier.revision, revisionHash: input.dossier.revisionHash, evidenceHash: input.dossier.evidenceHash, policySnapshotHash: input.dossier.policy.snapshotHash, atlasAttestationHash: digest(stable(input.attestation)), inspectorPrincipalId: input.identity.principalId, inspectorWorkloadId: input.identity.workloadId, issuedAt: input.now, result: input.result, reasonCode: input.reasonCode, nonce: input.nonce, signatureKeyId: this.signer.keyId };
    const inspection = Object.freeze({ ...unsigned, signature: this.signer.sign(unsigned) }); this.#usedIds.add(input.inspectionId); this.#consumedAtlas.add(input.attestation.attestationId); return { ...inspection };
  }
  verify(value: FinalInspection) { const { signature, ...unsigned } = value; return value.signatureKeyId === this.signer.keyId && this.signer.verify(unsigned, signature); }
}

export class P5AssuranceWorkflow {
  readonly #states = new Map<string, { status: AssuranceStatus; revision: number; revisionHash: string; chainHash: string }>(); readonly #events: AssuranceEvent[] = [];
  constructor(private readonly atlas: AtlasCompletenessAuthority, private readonly inspector: FinalKnowledgeInspectorAuthority) {}
  start(dossier: DossierRevision, now: string) { if (dossier.status !== 'KNOWLEDGE_GATE_READY') throw new Error('KNOWLEDGE_GATE_NOT_READY'); return this.transition(dossier, 'ATLAS_REVIEW', now, 'WORKFLOW'); }
  acceptAtlas(dossier: DossierRevision, attestation: AtlasAttestation, now: string) { if (!this.atlas.verify(attestation) || attestation.result !== 'ATLAS_OK') return this.transition(dossier, 'REWORK_REQUIRED', now, 'ATLAS_APPROVER'); if (!bindingMatches(dossier, attestation)) throw new Error('DOSSIER_ATTESTATION_BINDING_MISMATCH'); return this.transition(dossier, 'ATLAS_OK', now, 'ATLAS_APPROVER'); }
  beginInspection(dossier: DossierRevision, now: string) { if (this.#states.get(dossier.dossierId)?.status !== 'ATLAS_OK') throw new Error('ATLAS_OK_REQUIRED'); return this.transition(dossier, 'FINAL_INSPECTION', now, 'WORKFLOW'); }
  acceptInspection(dossier: DossierRevision, inspection: FinalInspection, now: string) { if (!this.inspector.verify(inspection) || inspection.dossierId !== dossier.dossierId || inspection.revisionHash !== dossier.revisionHash) throw new Error('INVALID_FINAL_INSPECTION'); return this.transition(dossier, inspection.result, now, 'FINAL_INSPECTOR'); }
  breakGlass(dossier: DossierRevision, identity: AssuranceIdentity, now: string) { if (identity.role !== 'OWNER_ADMIN') throw new Error('OWNER_ADMIN_REQUIRED'); return this.transition(dossier, 'OWNER_REVIEW', now, 'OWNER_ADMIN'); }
  activateKnowledge() { throw new Error('ACTIVE_KNOWLEDGE_FORBIDDEN_IN_P5'); }
  state(id: string) { const value = this.#states.get(id); return value ? { ...value } : undefined; } events() { return this.#events.map((item) => ({ ...item })); }
  snapshot() { const states = [...this.#states.entries()].map(([id, value]) => [id, { ...value }] as const); const events = this.events(); return { states, events, snapshotHash: digest(stable({ states, events })) }; }
  restore(snapshot: ReturnType<P5AssuranceWorkflow['snapshot']>) { if (snapshot.snapshotHash !== digest(stable({ states: snapshot.states, events: snapshot.events }))) throw new Error('ASSURANCE_SNAPSHOT_INTEGRITY_FAILURE'); this.#states.clear(); snapshot.states.forEach(([id, value]) => this.#states.set(id, Object.freeze({ ...value }))); this.#events.length = 0; snapshot.events.forEach((event) => this.#events.push(Object.freeze({ ...event }))); }
  private transition(dossier: DossierRevision, status: AssuranceStatus, occurredAt: string, actorRole: string) { const previous = this.#states.get(dossier.dossierId); const raw = { status, revision: dossier.revision, revisionHash: dossier.revisionHash, previousChainHash: previous?.chainHash ?? null }; const chainHash = digest(stable(raw)); this.#states.set(dossier.dossierId, Object.freeze({ status, revision: dossier.revision, revisionHash: dossier.revisionHash, chainHash })); const event = Object.freeze({ eventId: `p5-${digest(`${dossier.dossierId}:${status}:${occurredAt}`).slice(0, 24)}`, dossierId: dossier.dossierId, tenantId: dossier.tenantId, status, occurredAt, revision: dossier.revision, revisionHash: dossier.revisionHash, actorRole, chainHash }); this.#events.push(event); return { ...event }; }
}

export function createP5Signers(aggregationKey: Buffer, atlasKey: Buffer, inspectorKey: Buffer) { return { aggregation: new RoleSigner('p5-aggregation-dummy', aggregationKey), atlas: new RoleSigner('p5-atlas-dummy', atlasKey), inspector: new RoleSigner('p5-inspector-dummy', inspectorKey) }; }
function bindingMatches(dossier: DossierRevision, attestation: AtlasAttestation) { return dossier.dossierId === attestation.dossierId && dossier.revision === attestation.revision && dossier.revisionHash === attestation.revisionHash && dossier.evidenceHash === attestation.evidenceHash && dossier.policy.snapshotHash === attestation.policySnapshotHash; }
function enforceDistinct(dossier: DossierRevision, verdicts: VerdictRecord[], atlas: AssuranceIdentity, inspector?: AssuranceIdentity) { const principals = [dossier.proposerId, ...verdicts.filter((item) => item.revision === dossier.revision).map((item) => item.reviewerId), atlas.principalId, ...(inspector ? [inspector.principalId] : [])]; if (new Set(principals).size !== principals.length) throw new Error('SOD_PRINCIPAL_COLLISION'); const workloads = [...verdicts.filter((item) => item.revision === dossier.revision).map((item) => item.reviewerWorkloadId), atlas.workloadId, ...(inspector ? [inspector.workloadId] : [])]; if (new Set(workloads).size !== workloads.length) throw new Error('SOD_WORKLOAD_COLLISION'); }
function hasContradiction(verdicts: VerdictRecord[], revision: number) { const byDomain = new Map<string, Set<string>>(); verdicts.filter((item) => item.revision === revision).forEach((item) => { const values = byDomain.get(item.domain) ?? new Set(); values.add(item.verdict); byDomain.set(item.domain, values); }); return [...byDomain.values()].some((values) => values.size > 1); }
function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') { const record = value as Record<string, unknown>; return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`; } return JSON.stringify(value); }
