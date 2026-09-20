import assert from 'node:assert/strict';
import { bindPremiumLinguisticAgentHeartbeats, stopPremiumLinguisticAgentHeartbeatsForTest, type LinguisticHeartbeatTransport } from '../src/premium-linguistic-agents/premium-linguistic-agents.runtime';

const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let tick: (() => void) | undefined;
Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible', querySelectorAll: () => [], addEventListener: () => undefined } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: { setItem: () => undefined },
  setInterval: (callback: () => void) => { tick = callback; return 1; },
  clearInterval: () => undefined,
} });

const userCalls: string[] = [];
const adminCalls: string[] = [];
const releaseUser: Array<() => void> = [];
const accepted = () => new Response('{}', { status: 201 });
const userTransport: LinguisticHeartbeatTransport = {
  authority: 'user-session',
  route: (id) => `/operations/components/${id}/heartbeat`,
  fetcher: ((url: RequestInfo | URL) => {
    userCalls.push(String(url));
    return new Promise<Response>((resolve) => releaseUser.push(() => resolve(accepted())));
  }) as LinguisticHeartbeatTransport['fetcher'],
};
const adminTransport: LinguisticHeartbeatTransport = {
  authority: 'turn-admin-session',
  route: (id) => `/operations/turn/components/${id}/heartbeat`,
  fetcher: (async (url: RequestInfo | URL) => { adminCalls.push(String(url)); return accepted(); }) as LinguisticHeartbeatTransport['fetcher'],
};

try {
  const first = bindPremiumLinguisticAgentHeartbeats(undefined, userTransport);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(userCalls.length, 3);
  const rebound = bindPremiumLinguisticAgentHeartbeats(undefined, adminTransport);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(adminCalls.length, 3, 'Owner Access must not wait for the stale user transport to settle');
  releaseUser.splice(0).forEach((release) => release());
  await Promise.all([first, rebound]);
  assert.equal(adminCalls.length, 3, 'Owner Access must immediately republish all three heartbeats');
  tick?.();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(userCalls.length, 3, 'interval must not reuse the stale user transport');
  assert.equal(adminCalls.length, 6, 'next cycle must stay on the TURN admin transport');
  console.log(JSON.stringify({ status: 'PASS', immediateAdmin: 3, nextAdminCycle: 3, staleTransportReused: false }));
} finally {
  stopPremiumLinguisticAgentHeartbeatsForTest();
  if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
  if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
}
