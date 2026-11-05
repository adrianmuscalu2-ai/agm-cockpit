export const AGMATCC_LEDGER_KEY = 'agm.turn.agmatcc.ledger.v1';
export const AGMATCC_STREAM_KEY = 'agm.turn.agmatcc.stream.v1';

export type AgmatccEntryKind = 'voice-transcript-confirmed' | 'note' | 'playback' | 'search' | 'journal-link-opened';
export type AgmatccProvenance = 'voice-capture' | 'typed' | 'system';

export type AgmatccEntry = {
  readonly index: number;
  readonly id: string;
  readonly kind: AgmatccEntryKind;
  readonly provenance: AgmatccProvenance;
  readonly text: string;
  readonly language: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly previousHash: string;
  readonly hash: string;
};

export type AgmatccSearchHit = { entry: AgmatccEntry; score: number };

const GENESIS = 'GENESIS';

export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonical(entry: Omit<AgmatccEntry, 'hash'>) {
  return JSON.stringify([entry.index, entry.id, entry.kind, entry.provenance, entry.text, entry.language, entry.occurredAt, entry.actorId, entry.previousHash]);
}

export function randomUuid(): string {
  return globalThis.crypto.randomUUID();
}

/** Append-only: the only mutation is appending; no update or delete API exists. */
export async function appendAgmatccEntry(
  ledger: readonly AgmatccEntry[],
  input: { kind: AgmatccEntryKind; provenance: AgmatccProvenance; text: string; language: string; actorId: string; occurredAt?: string; id?: string },
): Promise<AgmatccEntry[]> {
  const text = input.text.trim();
  if (!text) throw new Error('AGMATCC_EMPTY_ENTRY');
  if (input.kind === 'voice-transcript-confirmed' && input.provenance !== 'voice-capture') throw new Error('AGMATCC_PROVENANCE_MISMATCH');
  const previous = ledger[ledger.length - 1];
  const base = {
    index: ledger.length,
    id: input.id ?? randomUuid(),
    kind: input.kind,
    provenance: input.provenance,
    text,
    language: input.language,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    actorId: input.actorId,
    previousHash: previous?.hash ?? GENESIS,
  };
  return [...ledger, { ...base, hash: await sha256Hex(canonical(base)) }];
}

export async function verifyAgmatccLedger(ledger: readonly AgmatccEntry[]): Promise<{ valid: boolean; brokenAt?: number }> {
  let previousHash = GENESIS;
  for (const [position, entry] of ledger.entries()) {
    if (entry.index !== position || entry.previousHash !== previousHash || entry.hash !== await sha256Hex(canonical(entry))) return { valid: false, brokenAt: position };
    previousHash = entry.hash;
  }
  return { valid: true };
}

/** Normalized lexical search (diacritics/case folded, token overlap). It is NOT embedding-based semantic search. */
export function searchAgmatccLedger(ledger: readonly AgmatccEntry[], query: string, limit = 20): AgmatccSearchHit[] {
  const tokens = foldText(query).split(' ').filter((token) => token.length > 1);
  if (!tokens.length) return [];
  return ledger
    .filter((entry) => entry.kind !== 'search')
    .map((entry) => {
      const haystack = foldText(entry.text);
      const words = new Set(haystack.split(' '));
      const score = tokens.reduce((sum, token) => sum + (words.has(token) ? 2 : haystack.includes(token) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.index - a.entry.index)
    .slice(0, limit);
}

export type AgmatccSyncItem = {
  idempotencyKey: string;
  expectedStreamVersion: number;
  event: Record<string, unknown>;
};

/** Maps ledger entries onto the existing operational-event.v1 contract (no parallel store). */
export function toOperationalSyncItems(
  ledger: readonly AgmatccEntry[],
  stream: { streamId: string; deviceId: string },
  fromIndex: number,
): AgmatccSyncItem[] {
  return ledger.slice(fromIndex).map((entry) => ({
    idempotencyKey: entry.id,
    expectedStreamVersion: entry.index - 1,
    event: {
      schemaVersion: 'operational-event.v1',
      eventId: entry.id,
      eventType: `agmatcc.${entry.kind}`,
      eventVersion: 1,
      occurredAt: entry.occurredAt,
      recordedAt: new Date().toISOString(),
      tripId: stream.streamId,
      aggregateType: 'TripContext',
      aggregateId: stream.streamId,
      aggregateVersion: entry.index,
      lifecycleState: 'agmatcc-recorded',
      operationalFlags: [],
      moduleId: 'agmatcc',
      actor: { type: entry.provenance === 'system' ? 'system' : 'user', id: entry.actorId },
      device: { id: stream.deviceId },
      operationId: entry.id,
      correlationId: stream.streamId,
      payload: { text: entry.text, language: entry.language, provenance: entry.provenance, ledgerHash: entry.hash, previousLedgerHash: entry.previousHash },
      evidenceRefs: [],
      classification: 'internal',
      retentionPolicyId: 'agmatcc-append-only',
      sync: { status: 'pending', deviceSequence: entry.index + 1 },
      integrity: ledger[entry.index - 1] ? { previousEventId: ledger[entry.index - 1].id } : {},
    },
  }));
}
