import {
  enforceVisionRateLimits,
  InMemoryVisionRateLimitStore,
  VISION_RATE_LIMITS,
  type RateLimitConsumption,
  type VisionRateLimitStore,
} from '../src/common/image-security/vision-rate-limiter';

describe('Vision rate limiter contract', () => {
  it('allows within all three limits without exposing raw identity in keys', async () => {
    const keys: string[] = [];
    const store: VisionRateLimitStore = {
      async consume(key, limit): Promise<RateLimitConsumption> {
        keys.push(key);
        return { allowed: true, remaining: limit - 1, retryAfterMs: 60_000 };
      },
    };

    const decision = await enforceVisionRateLimits(
      store,
      { actorId: 'driver-private', companyId: 'company-private' },
      'test-hmac-key',
      1_000,
    );

    expect(decision.allowed).toBe(true);
    expect(keys).toHaveLength(3);
    expect(keys.join('|')).not.toContain('driver-private');
    expect(keys.join('|')).not.toContain('company-private');
  });

  it('denies the eleventh request for one actor in the active window', async () => {
    const store = new InMemoryVisionRateLimitStore();
    const identity = { actorId: 'driver-1', companyId: 'company-1' };
    for (let count = 0; count < VISION_RATE_LIMITS.actor.limit; count += 1) {
      expect((await enforceVisionRateLimits(store, identity, 'key', 1_000)).allowed).toBe(true);
    }
    expect(await enforceVisionRateLimits(store, identity, 'key', 1_000)).toEqual({
      allowed: false,
      scope: 'actor',
      retryAfterMs: 60_000,
    });
  });

  it('resets a fixed window after expiry', async () => {
    const store = new InMemoryVisionRateLimitStore();
    const identity = { actorId: 'driver-1', companyId: 'company-1' };
    for (let count = 0; count < VISION_RATE_LIMITS.actor.limit; count += 1) {
      await enforceVisionRateLimits(store, identity, 'key', 1_000);
    }
    expect((await enforceVisionRateLimits(store, identity, 'key', 61_000)).allowed).toBe(true);
  });

  it.each(['company', 'global'] as const)('fails closed when the %s scope is exhausted', async (blockedScope) => {
    const store: VisionRateLimitStore = {
      async consume(key, limit) {
        const scope = key.includes(':actor:') ? 'actor' : key.includes(':company:') ? 'company' : 'global';
        return scope === blockedScope
          ? { allowed: false, remaining: 0, retryAfterMs: 12_345 }
          : { allowed: true, remaining: limit - 1, retryAfterMs: 60_000 };
      },
    };

    expect(await enforceVisionRateLimits(
      store,
      { actorId: 'driver', companyId: 'company' },
      'key',
      1_000,
    )).toEqual({ allowed: false, scope: blockedScope, retryAfterMs: 12_345 });
  });
});
