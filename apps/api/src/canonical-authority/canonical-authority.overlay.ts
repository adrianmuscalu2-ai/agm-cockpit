import { Injectable } from '@nestjs/common';

export type RuntimeFreshnessOverlay = {
  status: string;
  reviewRequired: boolean;
  evaluatedAt: string;
};

/**
 * Volatile read-through cache of state derived by the freshness engine.
 * It never stores source content, rules, rates, scope or authority and cannot
 * promote a source. Persistent state remains in SourceFreshnessRuntimeState.
 */
@Injectable()
export class CanonicalAuthorityRuntimeOverlay {
  private readonly states = new Map<string, RuntimeFreshnessOverlay>();
  get(sourceId: string) { return this.states.get(sourceId); }
  set(sourceId: string, state: RuntimeFreshnessOverlay) { this.states.set(sourceId, { ...state }); }
}
