import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const env = readFileSync('development.env.example', 'utf8');
const composeText = readFileSync('docker-compose.development.yml', 'utf8');
const policy = readFileSync('DEVELOPMENT_ENVIRONMENT_POLICY.md', 'utf8');
const ignore = readFileSync('.gitignore', 'utf8');

assert.match(composeText, /^name: agm-development$/m);
assert.match(composeText, /^services:\r?\n  postgres:$/m);
assert.doesNotMatch(composeText, /^  (?:api|web|deploy|migration|worker):$/m, 'development compose must not start mutation-capable services');
assert.match(composeText, /"127\.0\.0\.1:\$\{AGM_DEV_POSTGRES_PORT:-55432\}:5432"/);
assert.match(composeText, /POSTGRES_PASSWORD: \$\{AGM_DEV_POSTGRES_PASSWORD:\?set a development-only database password in development\.env\}/);
assert.match(composeText, /agm_development_postgres_data:\/var\/lib\/postgresql\/data/);
assert.match(composeText, /name: agm-development-postgres-data/);
assert.match(composeText, /name: agm-development-private/);

for (const required of [
  'NODE_ENV=development',
  'PORT=3100',
  'API_HOST=127.0.0.1',
  'TRUST_PROXY_HOPS=0',
  'AGM_DEV_WEB_PORT=5175',
  'AGM_DEV_POSTGRES_PORT=55432',
  'VITE_AGM_API_BASE_URL=http://127.0.0.1:3100/api/v1',
  'MACHINE_JWT_SECRET=replace-with-a-separate-development-only-random-secret-at-least-32-characters',
  'AGM_SOURCE_FRESHNESS_SCHEDULER_ENABLED=false',
]) assert.ok(env.includes(required), `missing development setting: ${required}`);

assert.doesNotMatch(env, /(?:api|app)\.agmcockpit\.com/i);
assert.doesNotMatch(env, /(?:0\.0\.0\.0|:5173\b|:5174\b)/);
assert.doesNotMatch(composeText, /(?:0\.0\.0\.0|:5173\b|:5174\b|:5432:5432)/);
assert.doesNotMatch(`${env}\n${composeText}`, /BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9]{16,}/);
assert.match(ignore, /^\/development\.env$/m);
assert.match(policy, /cannot publish or deploy/i);
assert.match(policy, /Do not add `--volumes`/);

console.log('AGM DEVELOPMENT ISOLATION: PASS');
console.log('SERVICES: postgres only');
console.log('BINDS: API 127.0.0.1:3100; Web 127.0.0.1:5175; PostgreSQL 127.0.0.1:55432');
console.log('PRODUCTION MUTATION PATHS: 0');
