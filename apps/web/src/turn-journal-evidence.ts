export const journalAvailabilityLabels = {
  LOCAL_JOURNAL: 'Jurnal local disponibil',
  HISTORICAL_PROJECTION: 'Proiecție istorică disponibilă',
};

export type JournalDeliveryEvidence = {
  state: 'CERTIFIED' | 'PENDING' | 'NOT_FOUND' | 'REVISION_MISMATCH';
  label: string;
  references: string[];
};

/** A delivery verdict belongs to the exact served revision and its canonical PCR. */
export function reconcileJournalDelivery(webRevision: string, apiRevision: string, data: unknown): JournalDeliveryEvidence {
  if (!/^[a-f0-9]{40}$/.test(webRevision) || !/^[a-f0-9]{40}$/.test(apiRevision)) throw new Error('BUILD_REVISION_MISSING');
  if (webRevision !== apiRevision) return {
    state: 'REVISION_MISMATCH', label: 'Versiunile Web și API diferă', references: [`Web ${webRevision}`, `API ${apiRevision}`],
  };
  const records = data as { versions?: Record<string, unknown>[]; pcrs?: Record<string, unknown>[] } | null;
  if (!records || !Array.isArray(records.versions) || !Array.isArray(records.pcrs)
    || [...records.versions, ...records.pcrs].some(row => !row || typeof row !== 'object')) throw new Error('CANONICAL_EVIDENCE_MALFORMED');
  const versions = records.versions.filter(row => row.commit_sha === webRevision && row.status === 'CANONICAL');
  const pcrIds = [...new Set(versions.flatMap(row => Array.isArray(row.pcr_refs) ? row.pcr_refs : []))];
  const references = [webRevision, ...versions.map(row => String(row.id)), ...pcrIds.map(String)];
  if (!versions.length) return { state: 'NOT_FOUND', label: 'Certificarea livrării curente nu a fost găsită', references };
  const pcrs = records.pcrs.filter(row => row.deploy_revision === webRevision && pcrIds.includes(row.id));
  const complete = versions.every(row => typeof row.id === 'string' && row.id.length > 0 && Array.isArray(row.pcr_refs) && row.pcr_refs.length > 0)
    && pcrIds.every(id => typeof id === 'string' && id.length > 0 && pcrs.filter(row => row.id === id).length === 1);
  if (!complete) return { state: 'PENDING', label: 'Legăturile PCR ale versiunii canonice sunt incomplete', references };
  const certified = pcrs.every(row => row.status === 'CLOSED' && row.final_verdict === 'PASS'
    && typeof row.post_deploy_verification === 'string' && row.post_deploy_verification.trim().length > 0
    && typeof row.validator_id === 'string' && row.validator_id.length > 0
    && typeof row.proposer_id === 'string' && row.proposer_id.length > 0
    && typeof row.executor_id === 'string' && row.executor_id.length > 0
    && row.validator_id !== row.proposer_id && row.validator_id !== row.executor_id);
  return {
    state: certified ? 'CERTIFIED' : 'PENDING',
    label: certified ? 'Livrare certificată · PCR CLOSED/PASS' : 'Livrare cu validare în curs sau dovezi incomplete',
    references,
  };
}
