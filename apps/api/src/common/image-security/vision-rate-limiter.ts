import { createHmac } from 'node:crypto';
import { VisionSecurityError } from './vision-request-security';

export const VISION_RATE_LIMITS = {
  actor: { limit: 10, windowMs: 60_000 },
  company: { limit: 100, windowMs: 60_000 },
  global: { limit: 500, windowMs: 60_000 },
} as const;

export type RateLimitConsumption = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export interface VisionRateLimitStore {
  consume(key: string, limit: number, windowMs: number, nowMs: number): Promise<RateLimitConsumption>;
}

export type VisionRateLimitDecision = {
  allowed: true;
  actorRemaining: number;
  companyRemaining: number;
  globalRemaining: number;
} | {
  allowed: false;
  scope: 'actor' | 'company' | 'global';
  retryAfterMs: number;
};

export async function enforceVisionRateLimits(
  store: VisionRateLimitStore,
  identity: { actorId: string; companyId: string },
  hmacKey: string,
  nowMs = Date.now(),
): Promise<VisionRateLimitDecision> {
  if (!identity.actorId || !identity.companyId || !hmacKey) {
    throw new VisionSecurityError('VISION_ACTOR_REQUIRED');
  }

  const actor = await store.consume(
    `vision:actor:${reference(identity.actorId, hmacKey)}`,
    VISION_RATE_LIMITS.actor.limit,
    VISION_RATE_LIMITS.actor.windowMs,
    nowMs,
  );
  if (!actor.allowed) return denied('actor', actor.retryAfterMs);

  const company = await store.consume(
    `vision:company:${reference(identity.companyId, hmacKey)}`,
    VISION_RATE_LIMITS.company.limit,
    VISION_RATE_LIMITS.company.windowMs,
    nowMs,
  );
  if (!company.allowed) return denied('company', company.retryAfterMs);

  const global = await store.consume(
    'vision:global',
    VISION_RATE_LIMITS.global.limit,
    VISION_RATE_LIMITS.global.windowMs,
    nowMs,
  );
  if (!global.allowed) return denied('global', global.retryAfterMs);

  return {
    allowed: true,
    actorRemaining: actor.remaining,
    companyRemaining: company.remaining,
    globalRemaining: global.remaining,
  };
}

function reference(value: string, key: string) {
  return createHmac('sha256', key).update(value).digest('hex').slice(0, 24);
}

function denied(scope: 'actor' | 'company' | 'global', retryAfterMs: number): VisionRateLimitDecision {
  return { allowed: false, scope, retryAfterMs };
}

export class InMemoryVisionRateLimitStore implements VisionRateLimitStore {
  private readonly windows = new Map<string, { count: number; resetsAt: number }>();

  async consume(key: string, limit: number, windowMs: number, nowMs: number): Promise<RateLimitConsumption> {
    const current = this.windows.get(key);
    const window = !current || nowMs >= current.resetsAt
      ? { count: 0, resetsAt: nowMs + windowMs }
      : current;

    if (window.count >= limit) {
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(1, window.resetsAt - nowMs) };
    }
    window.count += 1;
    this.windows.set(key, window);
    return {
      allowed: true,
      remaining: Math.max(0, limit - window.count),
      retryAfterMs: Math.max(0, window.resetsAt - nowMs),
    };
  }
}
