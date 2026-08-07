import { evaluateSecretMetadata } from '../src/secret-telemetry/secret-telemetry.service';

const valid = {
  JWT_SECRET: 'a-secure-session-secret-with-more-than-32-characters',
  DATABASE_URL: 'postgresql://reference-only',
  OPENAI_API_KEY: 'configured-provider-reference',
  AGM_TURN_ADMIN_PIN_HASH: '$2b$12$reference-not-a-secret-value',
};

describe('Secret & Credentials Guardian safe telemetry', () => {
  it('transitions CONFIGURED -> MISSING/INVALID -> CONFIGURED without exposing values', () => {
    const configured = evaluateSecretMetadata(valid, 'test', '2026-08-05T00:00:00.000Z');
    expect(configured.overallStatus).toBe('CONFIGURED');

    const degraded = evaluateSecretMetadata({ ...valid, OPENAI_API_KEY: '', AGM_TURN_ADMIN_PIN_HASH: 'invalid' }, 'test', '2026-08-05T00:01:00.000Z');
    expect(degraded.overallStatus).toBe('ATTENTION');
    expect(degraded.secrets.find((item) => item.id === 'translation-provider')?.status).toBe('MISSING');
    expect(degraded.secrets.find((item) => item.id === 'turn-administration')?.status).toBe('INVALID');

    const restored = evaluateSecretMetadata(valid, 'test', '2026-08-05T00:02:00.000Z');
    expect(restored.overallStatus).toBe('CONFIGURED');
    const serialized = JSON.stringify([configured, degraded, restored]);
    Object.values(valid).forEach((value) => expect(serialized).not.toContain(value));
  });

  it('recognizes the explicitly approved pre-release open Turn policy without fabricating a PIN', () => {
    const snapshot = evaluateSecretMetadata({
      ...valid,
      AGM_TURN_ADMIN_PIN_HASH: '',
      AGM_TURN_ADMIN_ACCESS_MODE: 'open-pre-release',
    }, 'production', '2026-08-06T00:00:00.000Z');

    expect(snapshot.secrets.find((item) => item.id === 'turn-administration')?.status).toBe('CONFIGURED');
    expect(JSON.stringify(snapshot)).not.toContain('open-pre-release');
  });
});
