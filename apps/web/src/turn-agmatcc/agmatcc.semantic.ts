import { cosine, embedText, matchedConcepts, queryConceptSet, SEMANTIC_DIMENSIONS, SEMANTIC_INDEX_VERSION, SEMANTIC_MIN_SCORE } from '@agm/shared';
import type { AgmatccEntry } from './agmatcc.ledger';

// The embedding core lives in @agm/shared so the API server-side index ranks identically.
export { cosine, embedText, SEMANTIC_DIMENSIONS, SEMANTIC_INDEX_VERSION, SEMANTIC_MIN_SCORE };

export type AgmatccSemanticHit = { entry: AgmatccEntry; score: number; matchedConcepts: string[]; source: string };

export function semanticSearchAgmatccLedger(ledger: readonly AgmatccEntry[], query: string, limit = 20): AgmatccSemanticHit[] {
  const queryVector = embedText(query);
  const queryConcepts = queryConceptSet(query);
  return ledger
    .filter((entry) => entry.kind !== 'search')
    .map((entry) => ({
      entry,
      score: cosine(queryVector, embedText(entry.text)),
      matchedConcepts: matchedConcepts(entry.text, queryConcepts),
      source: `${SEMANTIC_INDEX_VERSION}#${entry.index}:${entry.hash.slice(0, 12)}`,
    }))
    .filter((hit) => hit.score >= SEMANTIC_MIN_SCORE)
    .sort((a, b) => b.score - a.score || b.entry.index - a.entry.index)
    .slice(0, limit);
}
