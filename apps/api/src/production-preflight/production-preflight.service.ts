import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checkIds = new Set(['ssh-identity', 'ssh-agent', 'ssh-connectivity', 'ssh-authentication', 'console-rescue', 'production-api', 'guardian-telemetry', 'recovery-procedure']);
const statuses = new Set(['PASS', 'FAIL', 'NOT CONFIGURED']);

@Injectable()
export class ProductionPreflightService {
  constructor(private readonly config: ConfigService) {}

  snapshot() {
    const configured = this.config.get<string>('AGM_PRODUCTION_PREFLIGHT_REPORT_PATH')?.trim();
    const path = resolve(configured || resolve(process.cwd(), '..', '..', '.tmp', 'production-preflight.latest.json'));
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as Record<string, unknown>;
      if (parsed.contract !== 'agm-production-preflight.v1' || parsed.environment !== 'production' || !Array.isArray(parsed.checks)) throw new Error('INVALID_CONTRACT');
      const checks = parsed.checks.map((value) => {
        const item = value as Record<string, unknown>;
        if (!checkIds.has(String(item.id)) || !statuses.has(String(item.status))) throw new Error('INVALID_CHECK');
        return { id: String(item.id), status: String(item.status), checkedAt: String(item.checkedAt), safeDetail: String(item.safeDetail).slice(0, 240) };
      });
      return { contract: 'agm-production-preflight.v1', environment: 'production', checkedAt: String(parsed.checkedAt), overallStatus: checks.every((item) => item.status === 'PASS') ? 'READY' : 'ATTENTION', checks };
    } catch {
      const checkedAt = new Date().toISOString();
      return { contract: 'agm-production-preflight.v1', environment: 'production', checkedAt, overallStatus: 'ATTENTION', checks: [{ id: 'recovery-procedure', status: 'NOT CONFIGURED', checkedAt, safeDetail: 'Raportul runtime de preflight nu este disponibil.' }] };
    }
  }
}
