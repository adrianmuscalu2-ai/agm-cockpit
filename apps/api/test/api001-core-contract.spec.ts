import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { API_CORE_CONTRACT } from '../src/api-core.contract';

describe('API-001 core contract', () => {
  it('defines the stable API perimeter and health dependencies', () => {
    expect(API_CORE_CONTRACT.globalPrefix).toBe('api/v1');
    expect(API_CORE_CONTRACT.defaultPort).toBe(3000);
    expect(API_CORE_CONTRACT.throttle).toEqual({ limit: 100, ttlMs: 60_000 });
    expect(API_CORE_CONTRACT.health.requiredDependencies).toEqual(['database', 'translationProvider']);
  });

  it('keeps HTTP hardening and validation in the shared bootstrap', () => {
    const source = readFileSync(resolve(__dirname, '../src/http-application.ts'), 'utf8');
    expect(source).toMatch(/disable\('x-powered-by'\)/);
    expect(source).toMatch(/app\.use\(helmet\(\)\)/);
    expect(source).toMatch(/whitelist: true/);
    expect(source).toMatch(/forbidNonWhitelisted: true/);
    expect(source).toMatch(/API_CORE_CONTRACT\.globalPrefix/);
  });

  it('keeps liveness free of dependency probes and readiness dependent on PostgreSQL', () => {
    const source = readFileSync(resolve(__dirname, '../src/health.controller.ts'), 'utf8');
    const live = source.slice(source.indexOf("@Get('live')"), source.indexOf("@Get('ready')"));
    expect(live).not.toMatch(/\$queryRaw|OPENAI_API_KEY/);
    expect(source).toMatch(/\$queryRaw`SELECT 1`/);
    expect(source).toMatch(/OPENAI_API_KEY/);
  });
});
