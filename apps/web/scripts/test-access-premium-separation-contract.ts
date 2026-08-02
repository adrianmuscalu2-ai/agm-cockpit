import assert from 'node:assert/strict';
import { decidePremiumAccess } from '../src/premium-access/premium-access.guard';
import { renderPremiumAccessView } from '../src/premium-access/premium-access.view';
import { routeForShellView, shellViewFromRoute } from '../src/app-shell/navigation.contract';
import { createPremiumAccessClient, USER_ACCESS_TOKEN_KEY } from '../src/premium-access/premium-access.client';
import { clearVerifiedPremiumAccess, isPremiumNavigationAllowed, registerVerifiedPremiumAccess } from '../src/premium-access/premium-access.navigation';

const now = new Date('2026-08-01T12:00:00.000Z');
const premium = {
  subjectId: 'user-001', tier: 'premium' as const, status: 'active' as const,
  capabilities: ['premium.command-center' as const],
  evaluatedAt: '2026-08-01T11:59:00.000Z', policyVersion: 'access-entitlements@1.0.0' as const,
};

assert.deepEqual(decidePremiumAccess(undefined, 'premium.command-center', now), { outcome: 'deny', reason: 'missing' });
assert.equal(decidePremiumAccess({ ...premium, tier: 'basic' }, 'premium.command-center', now).outcome, 'deny');
assert.deepEqual(decidePremiumAccess({ ...premium, status: 'suspended' }, 'premium.command-center', now), { outcome: 'deny', reason: 'suspended' });
assert.deepEqual(decidePremiumAccess({ ...premium, validUntil: '2026-08-01T12:00:00.000Z' }, 'premium.command-center', now), { outcome: 'deny', reason: 'expired' });
assert.deepEqual(decidePremiumAccess(premium, 'premium.load-safety', now), { outcome: 'deny', reason: 'capability-missing' });
assert.equal(decidePremiumAccess(premium, 'premium.command-center', now).outcome, 'allow');
assert.deepEqual(decidePremiumAccess({ ...premium, policyVersion: 'invalid' }, 'premium.command-center', now), { outcome: 'deny', reason: 'invalid' });

assert.equal(shellViewFromRoute('/access'), 'access');
assert.equal(routeForShellView('access'), '/access');
const accessHtml = renderPremiumAccessView('ro', (value) => value);
assert.ok(accessHtml.includes('data-access-enforcement="session"'));
assert.ok(accessHtml.includes('data-module="home"'));
assert.ok(accessHtml.includes('data-module="premium"'));
assert.ok(accessHtml.includes('AGM Basic'));
assert.ok(accessHtml.includes('AGM Premium'));
assert.ok(accessHtml.includes('data-access-login'));
assert.ok(accessHtml.includes('data-access-premium-link hidden'));

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
};
const responses = [
  new Response(JSON.stringify({ data: { accessToken: 'token-001', user: { id: 'user-001', displayName: 'Test', email: 'test@example.com', roles: [] } } }), { status: 200 }),
  new Response(JSON.stringify({ data: premium }), { status: 200 }),
];
const requests: Array<{ url: string; init?: RequestInit }> = [];
const client = createPremiumAccessClient({
  apiBaseUrl: 'https://api.example.test/api/v1/', sessionStorage: storage,
  fetch: (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return responses.shift() ?? new Response('{}', { status: 500 });
  }) as typeof fetch,
});
assert.equal(client.hasSession(), false);
await client.login(' test@example.com ', 'secret');
assert.equal(memory.get(USER_ACCESS_TOKEN_KEY), 'token-001');
assert.equal((await client.entitlements()).tier, 'premium');
assert.equal(requests[0]?.url, 'https://api.example.test/api/v1/auth/login');
assert.equal((requests[1]?.init?.headers as Record<string, string>).Authorization, 'Bearer token-001');
client.logout();
assert.equal(client.hasSession(), false);

clearVerifiedPremiumAccess();
assert.equal(isPremiumNavigationAllowed('premium', now), false);
registerVerifiedPremiumAccess({ ...premium, capabilities: ['premium.command-center', 'premium.team'] });
assert.equal(isPremiumNavigationAllowed('premium', now), true);
assert.equal(isPremiumNavigationAllowed('premiumTeam', now), true);
assert.equal(isPremiumNavigationAllowed('premiumLoadSafety', now), false);
clearVerifiedPremiumAccess();
assert.equal(isPremiumNavigationAllowed('premium', now), false);

console.log('Access/Premium separation contract: PASS');
