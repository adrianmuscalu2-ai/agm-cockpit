import {
  createVisionSecurityEvent,
  validateVisionConsent,
  validateVisionConsentForPurpose,
  LOAD_SAFETY_CONSENT_POLICIES,
  VISION_CONSENT_POLICY,
  VisionSecurityError,
} from '../src/common/image-security/vision-request-security';

const now = new Date('2026-08-03T12:00:00.000Z');

describe('Vision request privacy and audit contract', () => {
  it('accepts explicit consent for the exact purpose and current versions', () => {
    const evidence = currentConsent('2026-08-03T11:59:00.000Z');
    expect(validateVisionConsent(evidence, now)).toEqual(evidence);
  });

  it('rejects absent consent', () => {
    expectSecurityCode(() => validateVisionConsent(undefined, now), 'IMAGE_CONSENT_REQUIRED');
  });

  it('validates exact-purpose Load Safety consent and rejects cross-purpose reuse', () => {
    const purpose = 'load-safety-analysis' as const;
    const policy = LOAD_SAFETY_CONSENT_POLICIES[purpose];
    const evidence = { confirmed: true, purpose, ...policy, consentedAt: '2026-08-03T11:59:00.000Z' } as const;
    expect(validateVisionConsentForPurpose(evidence, purpose, now)).toEqual(evidence);
    expectSecurityCode(() => validateVisionConsentForPurpose(evidence, 'load-safety-field-test', now), 'IMAGE_CONSENT_REQUIRED');
  });

  it('rejects a stale policy version', () => {
    expectSecurityCode(
      () => validateVisionConsent({ ...currentConsent(now.toISOString()), policyVersion: 'old' }, now),
      'IMAGE_CONSENT_VERSION_INVALID',
    );
  });

  it('rejects stale consent and future timestamps', () => {
    expectSecurityCode(
      () => validateVisionConsent(currentConsent('2026-08-03T11:40:00.000Z'), now),
      'IMAGE_CONSENT_TIMESTAMP_INVALID',
    );
    expectSecurityCode(
      () => validateVisionConsent(currentConsent('2026-08-03T12:02:00.000Z'), now),
      'IMAGE_CONSENT_TIMESTAMP_INVALID',
    );
  });

  it('builds an allowlisted audit event with pseudonymous actor references', () => {
    const sentinel = 'private-file-name-VIN-WVWZZZ.jpg';
    const event = createVisionSecurityEvent({
      requestId: 'req-123',
      actorId: `driver:${sentinel}`,
      companyId: `company:${sentinel}`,
      stage: 'sanitize',
      outcome: 'completed',
      code: 'IMAGE_SANITIZED',
      durationMs: 12.7,
      inputBytes: 2 * 1024 * 1024,
    }, 'test-only-audit-key');

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(sentinel);
    expect(event.actorRef).toMatch(/^[a-f0-9]{20}$/);
    expect(event.companyRef).toMatch(/^[a-f0-9]{20}$/);
    expect(event.inputSizeBucket).toBe('<=4MiB');
    expect(event.durationMs).toBe(13);
  });

  it('fails closed without actor, company, or HMAC key', () => {
    expectSecurityCode(() => createVisionSecurityEvent({
      requestId: 'req-123', actorId: '', companyId: 'company', stage: 'consent',
      outcome: 'denied', code: 'IMAGE_CONSENT_REQUIRED',
    }, 'key'), 'VISION_ACTOR_REQUIRED');
  });
});

function currentConsent(consentedAt: string) {
  return {
    confirmed: true,
    purpose: VISION_CONSENT_POLICY.purpose,
    policyVersion: VISION_CONSENT_POLICY.policyVersion,
    providerPolicyVersion: VISION_CONSENT_POLICY.providerPolicyVersion,
    consentedAt,
  } as const;
}

function expectSecurityCode(action: () => unknown, code: VisionSecurityError['code']) {
  try {
    action();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(VisionSecurityError);
    expect((error as VisionSecurityError).code).toBe(code);
  }
}
