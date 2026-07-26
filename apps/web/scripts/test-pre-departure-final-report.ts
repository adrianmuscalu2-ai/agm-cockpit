import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { createPreDepartureSession, transitionPreDeparture } from '../src/pre-departure/pre-departure.machine';
import { createPreDepartureFinalReport } from '../src/pre-departure/pre-departure.report';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

let session = transitionPreDeparture(createPreDepartureSession(), { type: 'START_SESSION' }).session;
session = transitionPreDeparture(session, {
  type: 'SELECT_CONTEXT',
  contexts: ['local'],
  applicableCheckIds: ['vehicle'],
}).session;
session = transitionPreDeparture(session, { type: 'ANSWER_CONFIRMED', checkId: 'vehicle' }).session;
session = transitionPreDeparture(session, { type: 'COMPLETE_ASSESSMENT' }).session;

await assert.rejects(
  createPreDepartureFinalReport(session, { clientSessionId: 'session-1' }),
  /confirmed or closed/,
);

session = transitionPreDeparture(session, { type: 'CONFIRM_READY' }).session;
session = {
  ...session,
  confirmation: {
    actorLabel: 'Șofer test',
    confirmedAt: '2026-07-26T05:00:00.000Z',
    statementVersion: 'pre-departure-confirmation-v1',
  },
};
const report = await createPreDepartureFinalReport(session, {
  clientSessionId: '11111111-1111-4111-8111-111111111111',
  generatedAt: '2026-07-26T05:01:00.000Z',
});
assert.equal(report.outcome, 'READY_FOR_DEPARTURE');
assert.equal(report.checks.length, 1);
assert.equal(report.integrity.algorithm, 'SHA-256');
assert.match(report.integrity.digest, /^[a-f0-9]{64}$/);
assert.equal(report.notice.includes('not a qualified electronic signature'), true);

console.log('Pre-departure final report: PASS');
