import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProductionPreflightService } from '../src/production-preflight/production-preflight.service';

describe('Production preflight safe report', () => {
  const directory = mkdtempSync(join(tmpdir(), 'agm-preflight-'));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));
  const checkedAt = '2026-09-05T16:00:00.000Z';
  const checkIds = ['ssh-identity', 'ssh-agent', 'ssh-connectivity', 'ssh-authentication', 'console-rescue', 'production-api', 'guardian-telemetry', 'recovery-procedure'];
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]) };
  const guardian = { snapshot: jest.fn(() => ({ contract: 'secret-telemetry.v1', overallStatus: 'ATTENTION', checkedAt })) };

  it('loads only revision-bound allowlisted metadata and refreshes live checks', async () => {
    const path = join(directory, 'report.json');
    const checks = checkIds.map((id) => ({ id, status: id === 'ssh-connectivity' ? 'FAIL' : 'PASS', checkedAt, safeDetail: `${id} evidence` }));
    writeFileSync(path, JSON.stringify({ contract: 'agm-production-preflight.v1', environment: 'production', revision: 'revision-1', producer: 'AGM_PRODUCTION_RELEASE', checkedAt, checks }));
    const config = { get: (key: string) => key === 'AGM_PRODUCTION_PREFLIGHT_REPORT_PATH' ? path : key === 'AGM_REVISION' ? 'revision-1' : undefined } as ConfigService;
    const snapshot = await new ProductionPreflightService(config, prisma as never, guardian as never).snapshot(new Date('2026-09-05T16:01:00.000Z'));
    expect(snapshot.overallStatus).toBe('ATTENTION');
    expect(snapshot.checks).toHaveLength(8);
    expect(snapshot.checks.find((item) => item.id === 'production-api')).toMatchObject({ status: 'PASS', checkedAt: '2026-09-05T16:01:00.000Z' });
    expect(snapshot.checks.find((item) => item.id === 'guardian-telemetry')).toMatchObject({ status: 'FAIL' });
    expect(snapshot.checks.find((item) => item.id === 'guardian-telemetry')?.safeDetail).toContain('ATTENTION');
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE KEY');
  });

  it('refuses incomplete or wrong-revision reports instead of producing false READY', async () => {
    const path = join(directory, 'invalid-report.json');
    writeFileSync(path, JSON.stringify({ contract: 'agm-production-preflight.v1', environment: 'production', revision: 'old-revision', checkedAt, checks: [{ id: 'production-api', status: 'PASS', checkedAt, safeDetail: 'partial' }] }));
    const config = { get: (key: string) => key === 'AGM_PRODUCTION_PREFLIGHT_REPORT_PATH' ? path : key === 'AGM_REVISION' ? 'current-revision' : undefined } as ConfigService;

    const snapshot = await new ProductionPreflightService(config, prisma as never, guardian as never).snapshot(new Date('2026-09-05T16:01:00.000Z'));

    expect(snapshot.overallStatus).toBe('ATTENTION');
    expect(snapshot.checks).toEqual([expect.objectContaining({ id: 'recovery-procedure', status: 'NOT CONFIGURED' })]);
  });
});
