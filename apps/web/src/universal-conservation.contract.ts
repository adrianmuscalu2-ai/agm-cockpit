export type ConservationSourceKind =
  | 'WORKTREE' | 'BRANCH' | 'BACKUP' | 'SNAPSHOT' | 'DOCKER_VOLUME'
  | 'LOCAL_DATABASE' | 'UNCOMMITTED_FILE' | 'ABANDONED_IMPLEMENTATION'
  | 'JOURNAL' | 'MANIFEST' | 'EVIDENCE' | 'CANONICAL_SOURCE' | 'ORPHAN_COPY';

export type ConservationSource = {
  id: string;
  kind: ConservationSourceKind;
  inventoried: boolean;
  extracted: boolean;
  archivedSeparately: boolean;
  integrityVerified: boolean;
};

export type ConservationAssessment = {
  verdict: 'BLOCK_DELETE' | 'ALLOW_DELETE_AFTER_EXPLICIT_AUTHORITY';
  missing: string[];
  coveredKinds: ConservationSourceKind[];
};

const requiredKinds: ConservationSourceKind[] = [
  'WORKTREE', 'BRANCH', 'BACKUP', 'SNAPSHOT', 'DOCKER_VOLUME', 'LOCAL_DATABASE',
  'UNCOMMITTED_FILE', 'ABANDONED_IMPLEMENTATION', 'JOURNAL', 'MANIFEST',
  'EVIDENCE', 'CANONICAL_SOURCE', 'ORPHAN_COPY',
];

export function assessConservationBeforeDeletion(sources: readonly ConservationSource[]): ConservationAssessment {
  const missing: string[] = [];
  for (const kind of requiredKinds) {
    const matching = sources.filter((source) => source.kind === kind);
    if (!matching.length) missing.push(`${kind}:NOT_INVENTORIED`);
    for (const source of matching) {
      if (!source.inventoried) missing.push(`${source.id}:INVENTORY_MISSING`);
      if (!source.extracted) missing.push(`${source.id}:EXTRACTION_MISSING`);
      if (!source.archivedSeparately) missing.push(`${source.id}:ARCHIVE_MISSING`);
      if (!source.integrityVerified) missing.push(`${source.id}:INTEGRITY_MISSING`);
    }
  }
  return {
    verdict: missing.length ? 'BLOCK_DELETE' : 'ALLOW_DELETE_AFTER_EXPLICIT_AUTHORITY',
    missing,
    coveredKinds: requiredKinds.filter((kind) => sources.some((source) => source.kind === kind)),
  };
}

export function deletionIsPermitted(assessment: ConservationAssessment, explicitAuthority: boolean): boolean {
  return assessment.verdict === 'ALLOW_DELETE_AFTER_EXPLICIT_AUTHORITY' && explicitAuthority;
}
