const insecureSecrets = new Set(['change-me-in-development', 'replace-me', 'secret']);

export type AgmEnvironment = Record<string, unknown> & {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  API_HOST: string;
  TRUST_PROXY_HOPS: number;
  CORS_ALLOWED_ORIGINS: string;
  JWT_SECRET: string;
  AGM_MACHINE_AUTH_SECRET?: string;
  DATABASE_URL: string;
  OPENAI_API_KEY: string;
};

export function validateEnvironment(values: Record<string, unknown>): AgmEnvironment {
  const nodeEnvironment = optionalString(values.NODE_ENV, 'development');
  if (!['development', 'test', 'production'].includes(nodeEnvironment)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const jwtSecret = requiredString(values, 'JWT_SECRET');
  if (jwtSecret.length < 32 || insecureSecrets.has(jwtSecret.toLowerCase())) {
    throw new Error('JWT_SECRET must contain at least 32 characters and must not be a placeholder.');
  }
  const machineSecret = optionalString(values.AGM_MACHINE_AUTH_SECRET, '');
  if (machineSecret && (machineSecret.length < 32 || insecureSecrets.has(machineSecret.toLowerCase()))) {
    throw new Error('AGM_MACHINE_AUTH_SECRET must contain at least 32 characters and must not be a placeholder.');
  }

  const allowedOrigins = optionalString(values.CORS_ALLOWED_ORIGINS, defaultCorsOrigins(nodeEnvironment));
  validateCorsOrigins(allowedOrigins, nodeEnvironment === 'production');

  return {
    ...values,
    NODE_ENV: nodeEnvironment as AgmEnvironment['NODE_ENV'],
    PORT: integerInRange(values.PORT, 3000, 1, 65_535, 'PORT'),
    API_HOST: optionalString(values.API_HOST, nodeEnvironment === 'production' ? '127.0.0.1' : '0.0.0.0'),
    TRUST_PROXY_HOPS: integerInRange(values.TRUST_PROXY_HOPS, nodeEnvironment === 'production' ? 1 : 0, 0, 10, 'TRUST_PROXY_HOPS'),
    CORS_ALLOWED_ORIGINS: allowedOrigins,
    JWT_SECRET: jwtSecret,
    ...(machineSecret ? { AGM_MACHINE_AUTH_SECRET: machineSecret } : {}),
    DATABASE_URL: requiredString(values, 'DATABASE_URL'),
    OPENAI_API_KEY: requiredString(values, 'OPENAI_API_KEY'),
  };
}

export function configuredCorsOrigins(value: string) {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function validateCorsOrigins(value: string, production: boolean) {
  const origins = configuredCorsOrigins(value);
  if (origins.length === 0) throw new Error('CORS_ALLOWED_ORIGINS must contain at least one origin.');

  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
    if (production && url.protocol !== 'https:') {
      throw new Error(`Production CORS origins must use HTTPS: ${origin}`);
    }
  }
}

function defaultCorsOrigins(nodeEnvironment: string) {
  return nodeEnvironment === 'production'
    ? 'https://localhost'
    : 'http://127.0.0.1:5173,http://localhost:5173,https://localhost';
}

function requiredString(values: Record<string, unknown>, key: string) {
  const value = optionalString(values[key], '');
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function integerInRange(value: unknown, fallback: number, minimum: number, maximum: number, key: string) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}
