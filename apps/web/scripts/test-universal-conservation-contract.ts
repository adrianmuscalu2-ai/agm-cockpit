import assert from 'node:assert/strict';
import { assessConservationBeforeDeletion, deletionIsPermitted, type ConservationSource } from '../src/universal-conservation.contract';

const kinds = ['WORKTREE', 'BRANCH', 'BACKUP', 'SNAPSHOT', 'DOCKER_VOLUME', 'LOCAL_DATABASE', 'UNCOMMITTED_FILE', 'ABANDONED_IMPLEMENTATION', 'JOURNAL', 'MANIFEST', 'EVIDENCE', 'CANONICAL_SOURCE', 'ORPHAN_COPY'] as const;
const complete: ConservationSource[] = kinds.map((kind) => ({ id: `source-${kind}`, kind, inventoried: true, extracted: true, archivedSeparately: true, integrityVerified: true }));
const incomplete = assessConservationBeforeDeletion(complete.map((source) => source.kind === 'DOCKER_VOLUME' ? { ...source, integrityVerified: false } : source));
assert.equal(incomplete.verdict, 'BLOCK_DELETE');
assert.equal(deletionIsPermitted(incomplete, true), false);
const completeAssessment = assessConservationBeforeDeletion(complete);
assert.equal(completeAssessment.missing.length, 0);
assert.equal(deletionIsPermitted(completeAssessment, false), false);
assert.equal(deletionIsPermitted(completeAssessment, true), true);
console.log('Universal conservation contract: PASS');
