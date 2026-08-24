export type AuthorityResourceSelector = {
  productId?: string;
  moduleId?: string;
  subjectType?: string;
  subjectIds?: readonly string[];
};

export type AuthorityCandidate = {
  scopeId: string;
  mode: string;
  writeSet: readonly string[];
  resourceSelectors: readonly AuthorityResourceSelector[];
};

export type AuthorityConflict = {
  conflict: boolean;
  reason?: 'SCOPE_OVERLAP' | 'WRITE_SET_OVERLAP' | 'RESOURCE_OVERLAP_UNPROVEN';
};

export type WriteBoundaryLease = {
  state: string;
  expiresAt: Date;
  epoch: number;
  fencingToken: number;
  scopeId: string;
  writeSet: readonly string[];
};

export function normalizeScope(scopeId: string) {
  return scopeId.trim().replace(/^\.+|\.+$/g, '').replace(/\.+/g, '.').toLowerCase();
}

export function scopesOverlap(left: string, right: string) {
  const a = normalizeScope(left);
  const b = normalizeScope(right);
  return a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}

export function commandSetsOverlap(left: readonly string[], right: readonly string[]) {
  return left.some((command) => right.some((candidate) => commandPatternOverlaps(command, candidate)));
}

export function selectorsProvablyDisjoint(
  left: readonly AuthorityResourceSelector[],
  right: readonly AuthorityResourceSelector[],
) {
  if (!left.length || !right.length) return false;
  return left.every((a) => right.every((b) => selectorPairDisjoint(a, b)));
}

export function detectAuthorityConflict(left: AuthorityCandidate, right: AuthorityCandidate): AuthorityConflict {
  if (left.mode !== 'EXECUTIVE' || right.mode !== 'EXECUTIVE') return { conflict: false };
  if (!scopesOverlap(left.scopeId, right.scopeId)) return { conflict: false };
  if (!commandSetsOverlap(left.writeSet, right.writeSet)) return { conflict: false };
  if (selectorsProvablyDisjoint(left.resourceSelectors, right.resourceSelectors)) return { conflict: false };
  return { conflict: true, reason: 'RESOURCE_OVERLAP_UNPROVEN' };
}

export function isCommandAllowed(command: string, allowed: readonly string[]) {
  return allowed.some((pattern) => commandPatternMatches(pattern, command));
}

export function evaluateWriteBoundary(
  lease: WriteBoundaryLease,
  request: { epoch: number; fencingToken: number; scopeId: string; command: string },
  now = new Date(),
) {
  if (!['AUTHORIZED', 'ACTIVE', 'DRAINING'].includes(lease.state)) return 'STALE_AUTHORITY_STATE' as const;
  if (lease.expiresAt <= now) return 'AUTHORITY_LEASE_EXPIRED' as const;
  if (lease.epoch !== request.epoch || lease.fencingToken !== request.fencingToken) return 'STALE_FENCING_TOKEN' as const;
  if (!normalizeScope(request.scopeId).startsWith(normalizeScope(lease.scopeId))) return 'DOMAIN_BOUNDARY_VIOLATION' as const;
  if (!isCommandAllowed(request.command, lease.writeSet)) return 'COMMAND_OUTSIDE_WRITE_SET' as const;
  return undefined;
}

export function isRunbookActionSetAllowed(requested: readonly string[], allowed: readonly string[]) {
  return requested.length > 0 && requested.every((action) => allowed.includes(action));
}

function commandPatternOverlaps(left: string, right: string) {
  return commandPatternMatches(left, right) || commandPatternMatches(right, left);
}

function commandPatternMatches(pattern: string, value: string) {
  const normalized = pattern.trim().toLowerCase();
  const candidate = value.trim().toLowerCase();
  if (normalized === '*') return true;
  if (normalized.endsWith('.*')) {
    const prefix = normalized.slice(0, -2);
    return candidate === prefix || candidate.startsWith(`${prefix}.`);
  }
  return normalized === candidate;
}

function selectorPairDisjoint(left: AuthorityResourceSelector, right: AuthorityResourceSelector) {
  for (const key of ['productId', 'moduleId', 'subjectType'] as const) {
    if (left[key] && right[key] && left[key] !== right[key]) return true;
  }
  if (left.subjectIds?.length && right.subjectIds?.length) {
    return !left.subjectIds.some((id) => right.subjectIds?.includes(id));
  }
  return false;
}
