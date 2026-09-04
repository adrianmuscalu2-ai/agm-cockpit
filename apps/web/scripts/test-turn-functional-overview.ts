import assert from 'node:assert/strict';
import { fetchTurnFunctionalOverview } from '../src/turn-functional-overview';

const payload = {
  data: {
    contractVersion: 'turn-functional-overview.v1',
    generatedAt: '2026-09-04T12:00:00.000Z',
    verdict: { turnFunctionalCompleteness: 'READY_FOR_PRODUCT_OWNER_REVIEW', productOwnerAcceptance: 'NOT_GRANTED', finalProductionPass: 'RETRACTED' },
    summary: { totalZones: 23, operational: 1, observed: 4, attention: 1, noActivity: 8, staticReference: 2, legitimateUnknown: 7, unresolvedUnknown: 0 },
    zones: [],
  },
};
let observedAuthorization = '';
const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  observedAuthorization = new Headers(init?.headers).get('Authorization') ?? '';
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

const result = await fetchTurnFunctionalOverview('owner-token', fetcher);
assert.equal(observedAuthorization, 'Bearer owner-token');
assert.equal(result.verdict.productOwnerAcceptance, 'NOT_GRANTED');
assert.equal(result.verdict.finalProductionPass, 'RETRACTED');
assert.equal(result.summary.unresolvedUnknown, 0);
console.log('TURN_FUNCTIONAL_OVERVIEW_WEB_CONTRACT=PASS');
