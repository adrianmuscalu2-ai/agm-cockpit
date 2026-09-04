import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATA001_PERSISTENCE_CONTRACT } from '../src/prisma/persistence.contract';

const repositoryRoot = resolve(__dirname, '../../..');
const schema = readFileSync(resolve(repositoryRoot, 'prisma/schema.prisma'), 'utf8');
const migrationsRoot = resolve(repositoryRoot, 'prisma/migrations');

describe('DATA-001 persistence contract', () => {
  it('keeps PostgreSQL as the explicit datasource provider', () => {
    expect(schema).toMatch(/datasource db\s*\{[\s\S]*?provider\s*=\s*"postgresql"/);
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
  });

  it('keeps every critical model in the canonical schema', () => {
    for (const model of DATA001_PERSISTENCE_CONTRACT.criticalModels) {
      expect(schema).toMatch(new RegExp(`model ${model}\\s*\\{`));
    }
  });

  it('keeps tenant ownership explicit on tenant-scoped models', () => {
    for (const model of DATA001_PERSISTENCE_CONTRACT.tenantScopedModels) {
      const body = modelBody(schema, model);
      expect(body).toMatch(/\bcompanyId\s+String\s+@db\.Uuid/);
    }
  });

  it('preserves the approved migration history byte-for-byte', () => {
    const directories = readdirSync(migrationsRoot)
      .filter((name) => statSync(resolve(migrationsRoot, name)).isDirectory())
      .sort();
    expect(directories).toEqual(DATA001_PERSISTENCE_CONTRACT.expectedMigrations.map(([name]) => name));
    for (const [name, expectedHash] of DATA001_PERSISTENCE_CONTRACT.expectedMigrations) {
      const sql = readFileSync(resolve(migrationsRoot, name, 'migration.sql'));
      expect(createHash('sha256').update(sql).digest('hex')).toBe(expectedHash);
    }
  });

  it('contains no destructive operation in the approved migration baseline', () => {
    for (const [name] of DATA001_PERSISTENCE_CONTRACT.expectedMigrations) {
      const sql = readFileSync(resolve(migrationsRoot, name, 'migration.sql'), 'utf8');
      expect(sql).not.toMatch(/\b(?:DROP\s+(?:TABLE|SCHEMA|DATABASE)|TRUNCATE)\b/i);
    }
  });

  it('provisions every heartbeat-emitting Premium linguist without asserting runtime state', () => {
    const sql = readFileSync(resolve(migrationsRoot, '20260905010000_reconcile_premium_linguist_registry', 'migration.sql'), 'utf8');
    for (const identity of ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv']) {
      expect(sql).toContain(identity);
    }
    expect(sql).toMatch(/ON CONFLICT \("companyId", "canonicalId"\) DO UPDATE/);
    expect(sql).toMatch(/ON CONFLICT \("companyId", "scopeId"\) DO UPDATE/);
    expect(sql).not.toMatch(/"lifecycleStatus"[^;]*(?:PASS|ONLINE|HEALTHY)/);
  });
});

function modelBody(value: string, model: string) {
  const start = value.indexOf(`model ${model} {`);
  if (start < 0) throw new Error(`Missing model ${model}`);
  const end = value.indexOf('\n}', start);
  if (end < 0) throw new Error(`Unclosed model ${model}`);
  return value.slice(start, end);
}
