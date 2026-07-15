import { configuredCorsOrigins, validateEnvironment } from '../src/config/environment';

const validEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://example.invalid/agm',
  OPENAI_API_KEY: 'test-openai-key',
  JWT_SECRET: 'a-secure-test-secret-with-more-than-32-characters',
  CORS_ALLOWED_ORIGINS: 'https://localhost,https://app.agm.example',
};

describe('environment validation', () => {
  it('normalizes a production environment', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: 'production',
      PORT: 3000,
      API_HOST: '127.0.0.1',
      TRUST_PROXY_HOPS: 1,
    });
  });

  it('rejects placeholder JWT secrets', () => {
    expect(() => validateEnvironment({ ...validEnvironment, JWT_SECRET: 'change-me-in-development' })).toThrow(
      'JWT_SECRET',
    );
  });

  it('rejects HTTP CORS origins in production', () => {
    expect(() => validateEnvironment({ ...validEnvironment, CORS_ALLOWED_ORIGINS: 'http://app.agm.example' })).toThrow(
      'HTTPS',
    );
  });

  it('parses configured origins without wildcards', () => {
    expect(configuredCorsOrigins('https://localhost, https://app.agm.example')).toEqual([
      'https://localhost',
      'https://app.agm.example',
    ]);
  });
});
