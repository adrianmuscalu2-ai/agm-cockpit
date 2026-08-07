import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProductionPreflightService } from '../src/production-preflight/production-preflight.service';

describe('Production preflight safe report', () => {
  const directory = mkdtempSync(join(tmpdir(), 'agm-preflight-'));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it('loads only allowlisted safe metadata', () => {
    const path = join(directory, 'report.json');
    writeFileSync(path, JSON.stringify({ contract: 'agm-production-preflight.v1', environment: 'production', checkedAt: '2026-08-06T08:00:00.000Z', checks: [{ id: 'ssh-connectivity', status: 'FAIL', checkedAt: '2026-08-06T08:00:00.000Z', safeDetail: 'Port 22 unavailable.' }] }));
    const config = { get: (key: string) => key === 'AGM_PRODUCTION_PREFLIGHT_REPORT_PATH' ? path : undefined } as ConfigService;
    const snapshot = new ProductionPreflightService(config).snapshot();
    expect(snapshot.overallStatus).toBe('ATTENTION');
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE KEY');
  });
});
