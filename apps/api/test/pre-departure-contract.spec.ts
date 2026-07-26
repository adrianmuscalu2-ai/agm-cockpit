import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PRE_DEPARTURE_CONTRACT_VERSION,
  type PreDepartureSessionPayload,
} from '../src/pre-departure-contract/pre-departure-contract.types';
import {
  applicableChecksForPreDepartureContexts,
  validatePreDepartureSessionPayload,
} from '../src/pre-departure-contract/pre-departure-contract.validation';
import { PRE_DEPARTURE_PERSISTENCE_CONSTRAINTS } from '../src/pre-departure-contract/pre-departure.persistence-model';

const now = '2026-07-26T02:00:00.000Z';

function validReadySession(): PreDepartureSessionPayload {
  return {
    contractVersion: PRE_DEPARTURE_CONTRACT_VERSION,
    clientSessionId: '11111111-1111-4111-8111-111111111111',
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
    transportJobId: '33333333-3333-4333-8333-333333333333',
    deviceId: '44444444-4444-4444-8444-444444444444',
    vehicleReference: 'B-AGM-01',
    trailerReference: 'AGM-TR-01',
    checklistVersion: 'pre-departure-checklist-v1',
    language: 'ro',
    contexts: ['local'],
    state: 'READY_TO_CONFIRM',
    answers: applicableChecksForPreDepartureContexts(['local']).map((checkId) => ({
      checkId,
      status: 'confirmed',
      answeredAt: now,
    })),
    clientRevision: 7,
    startedAt: now,
    updatedAt: now,
  };
}

describe('Pre-departure API contract v1', () => {
  it('accepts a complete session ready for confirmation', () => {
    const result = validatePreDepartureSessionPayload(validReadySession());
    expect(result).toEqual({ valid: true, value: validReadySession() });
  });

  it('derives a unique deterministic checklist from contexts', () => {
    expect(applicableChecksForPreDepartureContexts(['local', 'adr', 'adverse-weather'])).toEqual([
      'vehicle',
      'driver',
      'documents',
      'tachograph',
      'cargo',
      'route',
      'adr',
      'weather',
    ]);
  });

  it('rejects an unsupported contract version', () => {
    const payload = { ...validReadySession(), contractVersion: '2.0.0' };
    const result = validatePreDepartureSessionPayload(payload);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: 'contractVersion', code: 'invalid-value' }),
      );
    }
  });

  it('rejects duplicate answers', () => {
    const payload = validReadySession();
    payload.answers.push({ ...payload.answers[0] });
    const result = validatePreDepartureSessionPayload(payload);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({ path: 'answers', code: 'duplicate' }));
    }
  });

  it('requires a note for a problem answer', () => {
    const payload = validReadySession();
    payload.state = 'NEEDS_ATTENTION';
    payload.answers[0] = { ...payload.answers[0], status: 'problem' };
    const result = validatePreDepartureSessionPayload(payload);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: 'answers[0].note', code: 'required' }),
      );
    }
  });

  it('prevents a blocked session with incomplete checks', () => {
    const payload = validReadySession();
    payload.state = 'BLOCKED';
    payload.answers[0] = { ...payload.answers[0], status: 'problem', note: 'Tyre damage requires review.' };
    payload.answers.pop();
    const result = validatePreDepartureSessionPayload(payload);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: 'state', code: 'invalid-state' }),
      );
    }
  });

  it('requires confirmation timestamps for confirmed and closed sessions', () => {
    const payload = validReadySession();
    payload.state = 'CONFIRMED';
    const result = validatePreDepartureSessionPayload(payload);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: 'confirmedAt', code: 'required' }),
      );
    }
  });

  it('keeps tenant ownership outside the client payload', () => {
    expect(PRE_DEPARTURE_PERSISTENCE_CONSTRAINTS.ownershipFieldsFromAuthentication).toEqual([
      'companyId',
      'driverUserId',
    ]);
    expect(validReadySession()).not.toHaveProperty('companyId');
    expect(validReadySession()).not.toHaveProperty('driverUserId');
  });

  it('documents all versioned endpoints without activating them', () => {
    const contract = readFileSync(join(process.cwd(), 'contracts/pre-departure-v1.openapi.yaml'), 'utf8');
    expect(contract).toContain('version: 1.0.0');
    expect(contract).toContain('/pre-departure/sessions:');
    expect(contract).toContain('/pre-departure/sessions/{sessionId}/confirm:');
    expect(contract).toContain('/pre-departure/sessions/{sessionId}/close:');
    expect(contract).toContain('PRE_DEPARTURE_REVISION_CONFLICT');
  });
});

