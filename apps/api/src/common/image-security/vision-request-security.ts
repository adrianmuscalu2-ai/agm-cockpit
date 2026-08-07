import { createHmac } from 'node:crypto';

export const VISION_CONSENT_POLICY = {
  purpose: 'dashboard-warning-analysis',
  policyVersion: 'dashboard-warning-privacy-v0.1',
  providerPolicyVersion: 'provider-review-required-v0.1',
  maxAgeMs: 10 * 60 * 1000,
  maxFutureSkewMs: 60 * 1000,
} as const;

export type VisionConsentEvidence = {
  confirmed: true;
  purpose: typeof VISION_CONSENT_POLICY.purpose;
  policyVersion: string;
  providerPolicyVersion: string;
  consentedAt: string;
};

export type VisionSecurityErrorCode =
  | 'IMAGE_CONSENT_REQUIRED'
  | 'IMAGE_CONSENT_VERSION_INVALID'
  | 'IMAGE_CONSENT_TIMESTAMP_INVALID'
  | 'VISION_ACTOR_REQUIRED';

export class VisionSecurityError extends Error {
  constructor(readonly code: VisionSecurityErrorCode) {
    super(code);
    this.name = 'VisionSecurityError';
  }
}

export function validateVisionConsent(
  evidence: VisionConsentEvidence | undefined,
  now = new Date(),
): VisionConsentEvidence {
  if (!evidence?.confirmed || evidence.purpose !== VISION_CONSENT_POLICY.purpose) {
    throw new VisionSecurityError('IMAGE_CONSENT_REQUIRED');
  }
  if (
    evidence.policyVersion !== VISION_CONSENT_POLICY.policyVersion ||
    evidence.providerPolicyVersion !== VISION_CONSENT_POLICY.providerPolicyVersion
  ) {
    throw new VisionSecurityError('IMAGE_CONSENT_VERSION_INVALID');
  }

  const consentedAt = Date.parse(evidence.consentedAt);
  const age = now.getTime() - consentedAt;
  if (
    !Number.isFinite(consentedAt) ||
    age > VISION_CONSENT_POLICY.maxAgeMs ||
    age < -VISION_CONSENT_POLICY.maxFutureSkewMs
  ) {
    throw new VisionSecurityError('IMAGE_CONSENT_TIMESTAMP_INVALID');
  }
  return evidence;
}

export type VisionSecurityEventInput = {
  requestId: string;
  actorId: string;
  companyId: string;
  stage: 'consent' | 'sanitize' | 'transfer' | 'response' | 'cleanup';
  outcome: 'allowed' | 'denied' | 'failed' | 'completed';
  code: string;
  durationMs?: number;
  inputBytes?: number;
};

export type VisionSecurityEvent = {
  event: 'vision-security';
  requestId: string;
  actorRef: string;
  companyRef: string;
  stage: VisionSecurityEventInput['stage'];
  outcome: VisionSecurityEventInput['outcome'];
  code: string;
  durationMs?: number;
  inputSizeBucket?: '<=1MiB' | '<=4MiB' | '<=8MiB' | '>8MiB';
  controlVersion: 'image-security-v0.1';
};

export function createVisionSecurityEvent(
  input: VisionSecurityEventInput,
  auditHmacKey: string,
): VisionSecurityEvent {
  if (!input.actorId || !input.companyId || !auditHmacKey) {
    throw new VisionSecurityError('VISION_ACTOR_REQUIRED');
  }

  return {
    event: 'vision-security',
    requestId: input.requestId,
    actorRef: pseudonymousRef(input.actorId, auditHmacKey),
    companyRef: pseudonymousRef(input.companyId, auditHmacKey),
    stage: input.stage,
    outcome: input.outcome,
    code: input.code,
    ...(input.durationMs === undefined ? {} : { durationMs: Math.max(0, Math.round(input.durationMs)) }),
    ...(input.inputBytes === undefined ? {} : { inputSizeBucket: sizeBucket(input.inputBytes) }),
    controlVersion: 'image-security-v0.1',
  };
}

function pseudonymousRef(value: string, key: string) {
  return createHmac('sha256', key).update(value).digest('hex').slice(0, 20);
}

function sizeBucket(bytes: number): VisionSecurityEvent['inputSizeBucket'] {
  if (bytes <= 1024 * 1024) return '<=1MiB';
  if (bytes <= 4 * 1024 * 1024) return '<=4MiB';
  if (bytes <= 8 * 1024 * 1024) return '<=8MiB';
  return '>8MiB';
}
