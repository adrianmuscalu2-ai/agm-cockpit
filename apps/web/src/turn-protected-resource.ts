export type TurnProtectedResourceState = 'EMPTY' | 'NETWORK' | 'FRESH_CACHE' | 'STALE_CACHE';

export class TurnProtectedResourceHttpError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs: number) {
    super(message);
    this.name = 'TurnProtectedResourceHttpError';
  }
}

type CacheEntry<T> = { data: T; loadedAt: number };

export function createTurnProtectedResourceLoader<T>(options: {
  ttlMs?: number;
  defaultRateLimitBackoffMs?: number;
  now?: () => number;
} = {}) {
  const ttlMs = options.ttlMs ?? 60_000;
  const defaultRateLimitBackoffMs = options.defaultRateLimitBackoffMs ?? 60_000;
  const now = options.now ?? Date.now;
  let cached: CacheEntry<T> | undefined;
  let inFlight: Promise<T> | undefined;
  let retryAt = 0;
  let state: TurnProtectedResourceState = 'EMPTY';

  const read = async (load: () => Promise<T>, force = false): Promise<T> => {
    const currentTime = now();
    if (!force && cached && currentTime - cached.loadedAt < ttlMs) {
      state = 'FRESH_CACHE';
      return cached.data;
    }
    if (!force && currentTime < retryAt) {
      if (cached) {
        state = 'STALE_CACHE';
        return cached.data;
      }
      throw new TurnProtectedResourceHttpError('TURN_RATE_LIMIT_BACKOFF_ACTIVE', 429, retryAt - currentTime);
    }
    if (!inFlight) {
      const pending = load().then((data) => {
        cached = { data, loadedAt: now() };
        retryAt = 0;
        state = 'NETWORK';
        return data;
      }).catch((error: unknown) => {
        if (isTurnRateLimitError(error)) {
          retryAt = now() + Math.max(error.retryAfterMs, defaultRateLimitBackoffMs);
          if (cached) {
            state = 'STALE_CACHE';
            return cached.data;
          }
        }
        throw error;
      }).finally(() => {
        if (inFlight === pending) inFlight = undefined;
      });
      inFlight = pending;
    }
    return inFlight;
  };

  return {
    read,
    snapshot: () => ({ state, loadedAt: cached?.loadedAt ?? null, retryAfterMs: Math.max(0, retryAt - now()) }),
    reset: () => {
      cached = undefined;
      inFlight = undefined;
      retryAt = 0;
      state = 'EMPTY' as TurnProtectedResourceState;
    },
  };
}

export function turnProtectedResourceError(response: Response, message: string) {
  return new TurnProtectedResourceHttpError(message, response.status, response.status === 429 ? retryAfterMilliseconds(response.headers.get('Retry-After')) : 0);
}

export function isTurnRateLimitError(error: unknown): error is TurnProtectedResourceHttpError {
  return error instanceof TurnProtectedResourceHttpError && error.status === 429;
}

function retryAfterMilliseconds(value: string | null) {
  if (!value) return 60_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? 60_000 : Math.max(0, at - Date.now());
}
