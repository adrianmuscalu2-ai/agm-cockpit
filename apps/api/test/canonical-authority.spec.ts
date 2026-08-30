import { ConfigService } from '@nestjs/config';
import { CanonicalAuthorityLoader } from '../src/canonical-authority/canonical-authority.loader';
import { CanonicalAuthorityRuntimeOverlay } from '../src/canonical-authority/canonical-authority.overlay';
import { CanonicalAuthorityService } from '../src/canonical-authority/canonical-authority.service';

describe('canonical authority runtime policy', () => {
  const loader = new CanonicalAuthorityLoader(new ConfigService({ AGM_CANONICAL_LIBRARY_ROOT: '../..' }));
  const overlay = new CanonicalAuthorityRuntimeOverlay();
  const service = new CanonicalAuthorityService(loader, overlay);
  const evaluate = (sourceId: string, overrides: Partial<Parameters<typeof service.evaluate>[0]> = {}) => service.evaluate({
    domain: 'LEGISLATION_SAFETY',
    sourceId,
    jurisdiction: 'FR',
    evaluatedAt: '2026-08-30T12:00:00.000Z',
    purpose: 'NORMATIVE',
    scopeConfirmed: true,
    ...overrides,
  });

  it('loads and resolves the exact protected canonical baselines', () => {
    expect(loader.sources()).toHaveLength(862);
    expect(loader.domainMemberships('ROUTING_TOLL')).toHaveLength(289);
    expect(loader.domainMemberships('LEGISLATION_SAFETY')).toHaveLength(66);
    const result = evaluate('CS-FR-TRUCK-BAN-2026');
    expect(result.state).toBe('CANONICAL_CURRENT');
    expect(result.normativeAuthority).toBe(true);
    expect(result.trace).toMatchObject({
      canonicalRegistry: 'AGM_LIBRARY/REGISTRY/canonical-sources.json',
      canonicalView: 'AGM_LIBRARY/VIEWS/legislation-safety.view.json',
      authorityType: 'AUTHORITATIVE_WITH_SCOPE',
    });
  });

  it('never treats contextual evidence as normative authority', () => {
    const result = evaluate('CS-BE-FOD-TACHOGRAPH-20260701', { jurisdiction: 'BE' });
    expect(result.state).toBe('CONTEXTUAL_ONLY');
    expect(result.normativeAuthority).toBe(false);
    expect(result.resolvedValue).toBeNull();
  });

  it('blocks current use on the effectiveUntil calendar date', () => {
    const result = evaluate('CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026', {
      evaluatedAt: '2026-08-31T00:00:00.000Z',
    });
    expect(result.state).toBe('EXPIRED_REVIEW_REQUIRED');
    expect(result.usageDisposition).toBe('UNKNOWN_HUMAN_VERIFICATION');
    expect(result.normativeAuthority).toBe(false);
  });

  it('blocks a source with a detected successor and does not supersede it', () => {
    const result = evaluate('CS-CH-ARV1-20250501', { jurisdiction: 'CH' });
    expect(result.state).toBe('NEW_VERSION_DETECTED');
    expect(result.normativeAuthority).toBe(false);
    expect(result.trace?.freshnessStatus).toBe('NEW_VERSION_DETECTED');
  });

  it.each([
    [{ scopeConfirmed: false }, 'APPROVED_SOURCE_SCOPE_NOT_CONFIRMED_BY_CALLER'],
    [{ jurisdiction: 'DE' }, 'JURISDICTION_OUTSIDE_APPROVED_AUTHORITY'],
    [{ domain: 'ROUTING_TOLL' as const }, 'SOURCE_NOT_IN_CANONICAL_DOMAIN_VIEW'],
  ])('fails closed for a policy boundary', (overrides, reason) => {
    const result = evaluate('CS-FR-TRUCK-BAN-2026', overrides);
    expect(result.state).toBe('UNKNOWN_HUMAN_VERIFICATION');
    expect(result.reasons).toContain(reason);
    expect(result.resolvedValue).toBeNull();
  });

  it('applies persisted runtime freshness overlay without changing authority metadata', () => {
    overlay.set('CS-FR-TRUCK-BAN-2026', { status: 'FRESHNESS_UNKNOWN', reviewRequired: true, evaluatedAt: '2026-08-30T13:00:00Z' });
    const result = evaluate('CS-FR-TRUCK-BAN-2026');
    expect(result.state).toBe('FRESHNESS_UNKNOWN');
    expect(result.normativeAuthority).toBe(false);
    expect(result.trace?.authorityType).toBe('AUTHORITATIVE_WITH_SCOPE');
  });
});
