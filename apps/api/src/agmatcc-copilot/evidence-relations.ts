/** Explicit identifier overlap records association, never causation or regression. */
export function evidenceRelationKeys(value: unknown, depth = 0): Set<string> {
  const keys = new Set<string>();
  if (!value || typeof value !== 'object' || depth > 6) return keys;
  for (const [key, item] of Object.entries(value)) {
    if (/^(eventId|incidentId|mandateId|correlationId|validationId|releaseId|revision|commitSha|evidenceRef|evidenceReference|recordReference|executionEvidenceRef|validationEvidenceRef|previousEventId|sourceRef)$/i.test(key)
      && typeof item === 'string' && item.length >= 8 && item.length <= 250) keys.add(item);
    if (item && typeof item === 'object') for (const nested of evidenceRelationKeys(item, depth + 1)) keys.add(nested);
  }
  return keys;
}

export function explicitRelatedEvents<T extends { eventId: string; payload: unknown }>(candidates: readonly T[], selectedIds: readonly string[], limit: number) {
  const anchors = candidates.filter(row => selectedIds.includes(row.eventId)).map(row => ({ row, keys: new Set([row.eventId, ...evidenceRelationKeys(row.payload)]) }));
  return candidates.filter(row => !selectedIds.includes(row.eventId)).flatMap(row => {
    const keys = new Set([row.eventId, ...evidenceRelationKeys(row.payload)]);
    const relations = anchors.flatMap(anchor => [...keys].filter(key => anchor.keys.has(key)).map(key => ({ eventId: anchor.row.eventId, explicitReference: key })));
    return relations.length ? [{ row, relations }] : [];
  }).slice(0, limit);
}
