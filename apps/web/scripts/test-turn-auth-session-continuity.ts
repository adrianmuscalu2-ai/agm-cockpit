import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const sessionStorage = new MemoryStorage();
const localStorage = new MemoryStorage();
localStorage.setItem('agm.admin.session', JSON.stringify({ accessToken: 'legacy-permanent-token', expiresInSeconds: 900 }));

Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorage });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });

let generation = 0;
let refreshCalls = 0;
let forceAccessExpiry = false;
let refreshFailureStatus: number | null = null;
const calls: Array<{ url: string; authorization: string | null; credentials?: RequestCredentials }> = [];

globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  const headers = new Headers(init.headers);
  calls.push({ url, authorization: headers.get('Authorization'), credentials: init.credentials });

  if (url.endsWith('/turn-admin/refresh')) {
    refreshCalls += 1;
    if (refreshFailureStatus) return json(refreshFailureStatus, { message: refreshFailureStatus === 401 ? 'expired' : 'temporary refresh failure' });
    generation += 1;
    return json(201, { data: { accessToken: `access-${generation}`, expiresInSeconds: 900 } });
  }

  if (url.endsWith('/operations/turn/operational-dashboard')) {
    const expected = `Bearer access-${generation}`;
    if (forceAccessExpiry || headers.get('Authorization') !== expected) {
      forceAccessExpiry = false;
      return json(401, { message: 'expired access token' });
    }
    return json(200, { data: { contractVersion: 'turn-operational-dashboard.test' } });
  }

  return json(404, { message: 'unexpected route' });
}) as typeof fetch;

const auth = await import('../src/admin-auth');

assert.equal(localStorage.getItem(auth.ADMIN_SESSION_KEY), null, 'Persistent legacy JWT must be removed at startup.');
sessionStorage.setItem(auth.ADMIN_SESSION_KEY, JSON.stringify({ accessToken: 'access-0', expiresInSeconds: 900 }));

forceAccessExpiry = true;
const [first, second] = await Promise.all([
  auth.turnAdminAuthenticatedFetch('/operations/turn/operational-dashboard'),
  auth.turnAdminAuthenticatedFetch('/operations/turn/operational-dashboard'),
]);
assert.equal(first.status, 200);
assert.equal(second.status, 200);
assert.equal(refreshCalls, 1, 'Concurrent 401 responses in one context must share one refresh rotation.');
assert.equal(auth.readAdministratorSession()?.accessToken, 'access-1');

for (let cycle = 0; cycle < 4; cycle += 1) {
  forceAccessExpiry = true;
  const response = await auth.turnAdminAuthenticatedFetch('/operations/turn/operational-dashboard');
  assert.equal(response.status, 200, `Rotation cycle ${cycle + 1} must recover transparently.`);
}
assert.equal(refreshCalls, 5, 'Every forced access expiry must produce exactly one successful rotation.');
assert.equal(auth.readAdministratorSession()?.accessToken, 'access-5');
assert(calls.filter((call) => call.url.endsWith('/turn-admin/refresh')).every((call) => call.credentials === 'include'), 'Every refresh must include cookie credentials.');

sessionStorage.clear();
const restored = await auth.restoreAdministratorSession();
assert.equal(restored?.accessToken, 'access-6', 'Reload/reopen with empty sessionStorage must restore from the HttpOnly refresh cookie.');

refreshFailureStatus = 503;
forceAccessExpiry = true;
await assert.rejects(
  () => auth.turnAdminAuthenticatedFetch('/operations/turn/operational-dashboard'),
  (error: unknown) => auth.isTurnAdminSessionError(error) && error.status === 503,
  'A transient refresh failure must surface explicitly.',
);
assert.equal(auth.readAdministratorSession()?.accessToken, 'access-6', 'A transient refresh failure must not erase the session and force manual login.');

refreshFailureStatus = 401;
forceAccessExpiry = true;
await assert.rejects(
  () => auth.turnAdminAuthenticatedFetch('/operations/turn/operational-dashboard'),
  (error: unknown) => auth.isTurnAdminSessionError(error) && error.message === 'expired',
  'A failed silent refresh must surface an explicit auth/session error.',
);
assert.equal(auth.readAdministratorSession(), null, 'A terminal refresh failure must clear only the short-lived access token.');
assert.equal(localStorage.getItem(auth.ADMIN_SESSION_KEY), null, 'No administrative JWT may be persisted in localStorage.');

const mainSource = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.match(mainSource, /AUTH\/SESSION FAILURE/);
assert.match(mainSource, /adminSessionRetryTimer/);
assert.match(mainSource, /Nu este necesar PIN sau login manual/);
assert.match(mainSource, /autentificarea nu produce DEGRADED sau FAIL/);

console.log(JSON.stringify({
  verdict: 'PASS',
  concurrentRefreshCoalesced: true,
  successfulRotationCycles: 5,
  reloadContinuity: true,
  explicitAuthFailure: true,
  transientFailurePreservesSession: true,
  automaticRestoreRetry: true,
  persistentJwt: false,
}));

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
