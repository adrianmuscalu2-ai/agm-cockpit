import { createHash } from 'node:crypto';
import type { DossierRevision } from './p4-knowledge';
import type { FinalInspection } from './p5-assurance';
import { RoleSigner } from './p5-assurance';

export type PublicationIdentity = { principalId: string; workloadId: string; role: 'ARCHIVIST' | 'PUBLICATION_VERIFIER' | 'OWNER_ADMIN'; controlDomain: string };
export type PublicationStatus = 'APPROVED_NOT_ACTIVE' | 'ARCHIVE_COMMITTED' | 'PUBLICATION_VERIFYING' | 'ACTIVE_KNOWLEDGE' | 'SUPERSEDED' | 'RETRACTED' | 'EXPIRED' | 'OWNER_REVIEW';
export type PublishManifest = { manifestId: string; artifactId: string; dossierId: string; tenantId: string; dossierRevision: number; dossierRevisionHash: string; finalInspectionId: string; finalInspectionHash: string; contentHash: string; evidenceHash: string; policySnapshotHash: string; artifactHash: string; indexHash: string; readPathHash: string; semanticMetadataHash: string; visibility: 'TENANT'; issuedAt: string; expiresAt: string; nonce: string; archivistPrincipalId: string; archivistWorkloadId: string; signatureKeyId: string; signature: string };
export type PublicationReceipt = { receiptId: string; manifestId: string; manifestHash: string; artifactId: string; tenantId: string; verifiedArtifactHash: string; verifiedIndexHash: string; verifiedReadPathHash: string; verifiedVisibility: 'TENANT'; verifiedAt: string; verifierPrincipalId: string; verifierWorkloadId: string; nonce: string; signatureKeyId: string; signature: string };
export type PublicationEvent = { eventId: string; artifactId: string; dossierId: string; tenantId: string; status: PublicationStatus; occurredAt: string; manifestHash: string; actorRole: string; chainHash: string };

type Archived = { manifest: PublishManifest; artifact: string; index: string; readPath: string; status: PublicationStatus; receipt?: PublicationReceipt };
type FinalVerifier = { verify(value: FinalInspection): boolean };

export class ArchivistAuthority {
  readonly #manifestIds = new Map<string, string>(); readonly #nonces = new Set<string>();
  constructor(private readonly signer: RoleSigner, private readonly inspector: FinalVerifier, private readonly ttlMs: number) {}
  createManifest(input: { identity: PublicationIdentity; dossier: DossierRevision; inspection: FinalInspection; manifestId: string; artifactId: string; artifact: string; index: string; readPath: string; semanticMetadata: object; visibility: 'TENANT'; nonce: string; now: string }) {
    if (input.identity.role !== 'ARCHIVIST') throw new Error('ARCHIVIST_ROLE_REQUIRED');
    if (!this.inspector.verify(input.inspection) || input.inspection.result !== 'APPROVED_FOR_ARCHIVE') throw new Error('EXACT_FINAL_INSPECTION_REQUIRED');
    if (input.dossier.dossierId !== input.inspection.dossierId || input.dossier.revision !== input.inspection.revision || input.dossier.revisionHash !== input.inspection.revisionHash || input.dossier.evidenceHash !== input.inspection.evidenceHash || input.dossier.policy.snapshotHash !== input.inspection.policySnapshotHash) throw new Error('INSPECTION_DOSSIER_BINDING_MISMATCH');
    if ([input.dossier.proposerId, input.inspection.inspectorPrincipalId].includes(input.identity.principalId) || input.inspection.inspectorWorkloadId === input.identity.workloadId) throw new Error('ARCHIVIST_SOD_VIOLATION');
    if (!input.artifact || !input.index || !input.readPath) throw new Error('PUBLICATION_COMPONENT_MISSING');
    if (input.visibility !== 'TENANT') throw new Error('VISIBILITY_DENIED');
    if (this.#nonces.has(input.nonce)) throw new Error('MANIFEST_REPLAY');
    const unsigned = { manifestId: input.manifestId, artifactId: input.artifactId, dossierId: input.dossier.dossierId, tenantId: input.dossier.tenantId, dossierRevision: input.dossier.revision, dossierRevisionHash: input.dossier.revisionHash, finalInspectionId: input.inspection.inspectionId, finalInspectionHash: digest(stable(input.inspection)), contentHash: input.dossier.contentHash, evidenceHash: input.dossier.evidenceHash, policySnapshotHash: input.dossier.policy.snapshotHash, artifactHash: digest(input.artifact), indexHash: digest(input.index), readPathHash: digest(input.readPath), semanticMetadataHash: digest(stable(input.semanticMetadata)), visibility: input.visibility, issuedAt: input.now, expiresAt: new Date(Date.parse(input.now) + this.ttlMs).toISOString(), nonce: input.nonce, archivistPrincipalId: input.identity.principalId, archivistWorkloadId: input.identity.workloadId, signatureKeyId: this.signer.keyId };
    const manifest = Object.freeze({ ...unsigned, signature: this.signer.sign(unsigned) });
    const manifestHash = digest(stable(manifest)); const prior = this.#manifestIds.get(input.manifestId);
    if (prior && prior !== manifestHash) throw new Error('MANIFEST_ID_CONFLICT');
    this.#manifestIds.set(input.manifestId, manifestHash); this.#nonces.add(input.nonce); return { ...manifest };
  }
  verify(value: PublishManifest) { const { signature, ...unsigned } = value; return value.signatureKeyId === this.signer.keyId && this.signer.verify(unsigned, signature); }
  activate() { throw new Error('ARCHIVIST_CANNOT_ACTIVATE'); }
}

export class PublicationVerifierAuthority {
  readonly #receiptIds = new Set<string>(); readonly #manifestUses = new Set<string>();
  constructor(private readonly signer: RoleSigner, private readonly archivist: ArchivistAuthority) {}
  verifyAndAttest(input: { identity: PublicationIdentity; manifest: PublishManifest; artifact: string; index: string; readPath: string; receiptId: string; nonce: string; now: string }) {
    if (input.identity.role !== 'PUBLICATION_VERIFIER') throw new Error('PUBLICATION_VERIFIER_ROLE_REQUIRED');
    if (input.identity.principalId === input.manifest.archivistPrincipalId || input.identity.workloadId === input.manifest.archivistWorkloadId) throw new Error('PUBLICATION_VERIFIER_SOD_VIOLATION');
    if (!this.archivist.verify(input.manifest)) throw new Error('FORGED_PUBLISH_MANIFEST');
    if (Date.parse(input.now) >= Date.parse(input.manifest.expiresAt)) throw new Error('EXPIRED_PUBLISH_MANIFEST');
    if (this.#receiptIds.has(input.receiptId) || this.#manifestUses.has(input.manifest.manifestId)) throw new Error('PUBLICATION_REPLAY');
    if (digest(input.artifact) !== input.manifest.artifactHash) throw new Error('ARTIFACT_HASH_MISMATCH');
    if (digest(input.index) !== input.manifest.indexHash) throw new Error('INDEX_HASH_MISMATCH');
    if (digest(input.readPath) !== input.manifest.readPathHash) throw new Error('READ_PATH_HASH_MISMATCH');
    if (input.manifest.visibility !== 'TENANT') throw new Error('VISIBILITY_DENIED');
    const unsigned = { receiptId: input.receiptId, manifestId: input.manifest.manifestId, manifestHash: digest(stable(input.manifest)), artifactId: input.manifest.artifactId, tenantId: input.manifest.tenantId, verifiedArtifactHash: input.manifest.artifactHash, verifiedIndexHash: input.manifest.indexHash, verifiedReadPathHash: input.manifest.readPathHash, verifiedVisibility: input.manifest.visibility, verifiedAt: input.now, verifierPrincipalId: input.identity.principalId, verifierWorkloadId: input.identity.workloadId, nonce: input.nonce, signatureKeyId: this.signer.keyId };
    const receipt = Object.freeze({ ...unsigned, signature: this.signer.sign(unsigned) }); this.#receiptIds.add(input.receiptId); this.#manifestUses.add(input.manifest.manifestId); return { ...receipt };
  }
  verify(value: PublicationReceipt) { const { signature, ...unsigned } = value; return value.signatureKeyId === this.signer.keyId && this.signer.verify(unsigned, signature); }
}

export class KnowledgeLibrary {
  readonly #archive = new Map<string, Archived>(); readonly #activeAlias = new Map<string, string>(); readonly #priorAlias = new Map<string, string | undefined>(); readonly #events: PublicationEvent[] = [];
  constructor(private readonly archivist: ArchivistAuthority, private readonly verifier: PublicationVerifierAuthority) {}
  approved(manifest: PublishManifest, now: string) { if (!this.archivist.verify(manifest)) throw new Error('INVALID_MANIFEST'); return this.event(manifest, 'APPROVED_NOT_ACTIVE', now, 'FINAL_INSPECTOR'); }
  commit(manifest: PublishManifest, artifact: string, index: string, readPath: string, now: string, fault?: 'PARTIAL_WRITE' | 'INDEX_FAILURE') {
    if (!this.archivist.verify(manifest)) throw new Error('INVALID_MANIFEST'); if (fault) throw new Error(fault);
    if (digest(artifact) !== manifest.artifactHash || digest(index) !== manifest.indexHash || digest(readPath) !== manifest.readPathHash) throw new Error('COMMIT_HASH_MISMATCH');
    const existing = this.#archive.get(manifest.artifactId); if (existing) { if (digest(stable(existing.manifest)) !== digest(stable(manifest))) throw new Error('IMMUTABLE_ARCHIVE_CONFLICT'); return this.event(manifest, 'ARCHIVE_COMMITTED', now, 'ARCHIVIST'); }
    this.#archive.set(manifest.artifactId, Object.freeze({ manifest: { ...manifest }, artifact, index, readPath, status: 'ARCHIVE_COMMITTED' })); return this.event(manifest, 'ARCHIVE_COMMITTED', now, 'ARCHIVIST');
  }
  beginVerification(manifest: PublishManifest, now: string) { if (!this.#archive.has(manifest.artifactId)) throw new Error('ARCHIVE_REQUIRED'); return this.event(manifest, 'PUBLICATION_VERIFYING', now, 'WORKFLOW'); }
  activate(receipt: PublicationReceipt, now: string) {
    if (!this.verifier.verify(receipt)) throw new Error('VALID_VERIFIER_RECEIPT_REQUIRED'); const record = this.#archive.get(receipt.artifactId); if (!record || digest(stable(record.manifest)) !== receipt.manifestHash) throw new Error('RECEIPT_ARCHIVE_BINDING_MISMATCH');
    const old = this.#activeAlias.get(record.manifest.tenantId); this.#priorAlias.set(record.manifest.tenantId, old); if (old && old !== receipt.artifactId) { const prior = this.#archive.get(old); if (prior) this.#archive.set(old, Object.freeze({ ...prior, status: 'SUPERSEDED' })); }
    this.#activeAlias.set(record.manifest.tenantId, receipt.artifactId); this.#archive.set(receipt.artifactId, Object.freeze({ ...record, status: 'ACTIVE_KNOWLEDGE', receipt: { ...receipt } })); return this.event(record.manifest, 'ACTIVE_KNOWLEDGE', now, 'PUBLICATION_VERIFIER');
  }
  retract(artifactId: string, now: string) { const record = this.required(artifactId); this.#archive.set(artifactId, Object.freeze({ ...record, status: 'RETRACTED' })); if (this.#activeAlias.get(record.manifest.tenantId) === artifactId) this.#activeAlias.delete(record.manifest.tenantId); return this.event(record.manifest, 'RETRACTED', now, 'OWNER_ADMIN'); }
  expire(artifactId: string, now: string) { const record = this.required(artifactId); this.#archive.set(artifactId, Object.freeze({ ...record, status: 'EXPIRED' })); if (this.#activeAlias.get(record.manifest.tenantId) === artifactId) this.#activeAlias.delete(record.manifest.tenantId); return this.event(record.manifest, 'EXPIRED', now, 'WORKFLOW'); }
  rollbackAlias(tenantId: string, now: string) { const current = this.#activeAlias.get(tenantId); const prior = this.#priorAlias.get(tenantId); if (!current || !prior) throw new Error('ROLLBACK_ALIAS_UNAVAILABLE'); const currentRecord = this.required(current); const priorRecord = this.required(prior); this.#activeAlias.set(tenantId, prior); this.#archive.set(current, Object.freeze({ ...currentRecord, status: 'RETRACTED' })); this.#archive.set(prior, Object.freeze({ ...priorRecord, status: 'ACTIVE_KNOWLEDGE' })); return this.event(priorRecord.manifest, 'ACTIVE_KNOWLEDGE', now, 'ROLLBACK'); }
  active(tenantId: string) { const id = this.#activeAlias.get(tenantId); const value = id ? this.#archive.get(id) : undefined; return value ? clone(value) : undefined; }
  archived(id: string) { const value = this.#archive.get(id); return value ? clone(value) : undefined; }
  events() { return this.#events.map((event) => ({ ...event })); }
  snapshot() { const archive = [...this.#archive.entries()].map(([id, value]) => [id, clone(value)] as const); const aliases = [...this.#activeAlias.entries()]; const prior = [...this.#priorAlias.entries()]; const events = this.events(); return { archive, aliases, prior, events, snapshotHash: digest(stable({ archive, aliases, prior, events })) }; }
  restore(snapshot: ReturnType<KnowledgeLibrary['snapshot']>) { if (snapshot.snapshotHash !== digest(stable({ archive: snapshot.archive, aliases: snapshot.aliases, prior: snapshot.prior, events: snapshot.events }))) throw new Error('LIBRARY_SNAPSHOT_INTEGRITY_FAILURE'); this.#archive.clear(); snapshot.archive.forEach(([id, value]) => this.#archive.set(id, Object.freeze(clone(value)))); this.#activeAlias.clear(); snapshot.aliases.forEach(([tenant, id]) => this.#activeAlias.set(tenant, id)); this.#priorAlias.clear(); snapshot.prior.forEach(([tenant, id]) => this.#priorAlias.set(tenant, id)); this.#events.length = 0; snapshot.events.forEach((event) => this.#events.push(Object.freeze({ ...event }))); }
  private required(id: string) { const value = this.#archive.get(id); if (!value) throw new Error('ARCHIVE_NOT_FOUND'); return value; }
  private event(manifest: PublishManifest, status: PublicationStatus, occurredAt: string, actorRole: string) { const previous = this.#events.at(-1)?.chainHash ?? null; const raw = { artifactId: manifest.artifactId, dossierId: manifest.dossierId, tenantId: manifest.tenantId, status, occurredAt, manifestHash: digest(stable(manifest)), actorRole, previous }; const chainHash = digest(stable(raw)); const event = Object.freeze({ eventId: `p6-${digest(stable(raw)).slice(0, 24)}`, ...raw, chainHash }); this.#events.push(event); return { ...event }; }
}

export function projectPublicationTurn(events: PublicationEvent[]) { const views = new Map<string, { artifactId: string; dossierId: string; tenantId: string; status: PublicationStatus; occurredAt: string; manifestHash: string }>(); for (const event of events) views.set(event.artifactId, Object.freeze({ artifactId: event.artifactId, dossierId: event.dossierId, tenantId: event.tenantId, status: event.status, occurredAt: event.occurredAt, manifestHash: event.manifestHash })); return [...views.values()].map((value) => ({ ...value })); }
export function createP6Signers(archivistKey: Buffer, verifierKey: Buffer) { return { archivist: new RoleSigner('p6-archivist-dummy', archivistKey), verifier: new RoleSigner('p6-verifier-dummy', verifierKey) }; }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') { const record = value as Record<string, unknown>; return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`; } return JSON.stringify(value); }
