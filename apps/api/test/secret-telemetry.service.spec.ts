import { evaluateSecretMetadata } from '../src/secret-telemetry/secret-telemetry.service';

const valid = {
  JWT_SECRET: 'a-secure-session-secret-with-more-than-32-characters',
  DATABASE_URL: 'postgresql://reference-only',
  OPENAI_API_KEY: 'configured-provider-reference',
  TOMTOM_API_KEY: 'A1B2C3D4E5F6',
  HERE_API_KEY: 'guardian-reference-here-key',
  TOLLGURU_API_KEY: 'guardian-reference-toll-key',
  GMAIL_OAUTH_CLIENT_ID: 'guardian-reference.apps.googleusercontent.com',
  GMAIL_OAUTH_CLIENT_SECRET: 'guardian-client-secret-reference',
  GMAIL_OAUTH_REFRESH_TOKEN: 'guardian-refresh-token-reference',
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

  it('accepts an official 12-character alphanumeric TomTom key without exposing it', () => {
    const snapshot = evaluateSecretMetadata(valid, 'test', '2026-08-24T13:00:00.000Z');
    expect(snapshot.secrets.find((item) => item.id === 'live-mobility-tomtom')?.status).toBe('CONFIGURED');
    expect(JSON.stringify(snapshot)).not.toContain(valid.TOMTOM_API_KEY);
  });
});
