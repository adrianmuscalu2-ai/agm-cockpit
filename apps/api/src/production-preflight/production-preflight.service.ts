import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { SecretTelemetryService } from '../secret-telemetry/secret-telemetry.service';

const checkIds = new Set(['ssh-identity', 'ssh-agent', 'ssh-connectivity', 'ssh-authentication', 'console-rescue', 'production-api', 'guardian-telemetry', 'recovery-procedure']);
const statuses = new Set(['PASS', 'FAIL', 'NOT CONFIGURED']);

@Injectable()
export class ProductionPreflightService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly secretTelemetry: SecretTelemetryService,
  ) {}

  async snapshot(now = new Date()) {
    const configured = this.config.get<string>('AGM_PRODUCTION_PREFLIGHT_REPORT_PATH')?.trim();
    const path = resolve(configured || resolve(process.cwd(), '..', '..', '.tmp', 'production-preflight.latest.json'));
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as Record<string, unknown>;
      if (parsed.contract !== 'agm-production-preflight.v1' || parsed.environment !== 'production' || !Array.isArray(parsed.checks)) throw new Error('INVALID_CONTRACT');
      const revision = String(parsed.revision ?? '');
      const expectedRevision = this.config.get<string>('AGM_REVISION')?.trim();
      if (!revision || (expectedRevision && revision !== expectedRevision)) throw new Error('REVISION_MISMATCH');
      if (parsed.producer !== 'AGM_PRODUCTION_RELEASE') throw new Error('INVALID_PRODUCER');
      if (!Number.isFinite(Date.parse(String(parsed.checkedAt)))) throw new Error('INVALID_CHECKED_AT');
      const checks = parsed.checks.map((value) => {
        const item = value as Record<string, unknown>;
        if (!checkIds.has(String(item.id)) || !statuses.has(String(item.status))) throw new Error('INVALID_CHECK');
        const checkedAt = String(item.checkedAt);
        const safeDetail = String(item.safeDetail).slice(0, 240);
        if (!Number.isFinite(Date.parse(checkedAt)) || !safeDetail) throw new Error('INVALID_CHECK_EVIDENCE');
        return { id: String(item.id), status: String(item.status), checkedAt, safeDetail };
      });
      if (checks.length !== checkIds.size || new Set(checks.map((item) => item.id)).size !== checkIds.size) throw new Error('INCOMPLETE_CHECK_SET');

      let databaseAvailable = false;
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        databaseAvailable = true;
      } catch {
        databaseAvailable = false;
      }
      const guardian = this.secretTelemetry.snapshot();
      const guardianAttention = guardian.secrets
        .filter((item) => item.status !== 'CONFIGURED')
        .map((item) => `${item.id}:${item.status}`)
        .join(', ');
      const checkedAt = now.toISOString();
      const liveChecks = checks.map((check) => check.id === 'production-api'
        ? { ...check, status: databaseAvailable ? check.status : 'FAIL', checkedAt, safeDetail: databaseAvailable ? 'API process and PostgreSQL dependency are currently available.' : 'API process is running, but PostgreSQL dependency is unavailable.' }
        : check.id === 'guardian-telemetry'
          ? {
            ...check,
            status: guardian.contract && guardian.overallStatus === 'CONFIGURED' ? check.status : 'FAIL',
            checkedAt,
            safeDetail: guardianAttention
              ? `Secret telemetry producer responded ${guardian.overallStatus}; affected metadata: ${guardianAttention}. Values remain redacted.`
              : `Secret telemetry producer responded ${guardian.overallStatus}; all active references are configured. Values remain redacted.`,
          }
          : check);
      return {
        contract: 'agm-production-preflight.v1',
        environment: 'production',
        revision,
        producer: parsed.producer,
        checkedAt,
        sourceCheckedAt: String(parsed.checkedAt),
        overallStatus: liveChecks.every((item) => item.status === 'PASS') ? 'READY' : 'ATTENTION',
        checks: liveChecks,
      };
    } catch (error) {
      const checkedAt = now.toISOString();
      const reason = error instanceof Error && ['INVALID_CONTRACT', 'REVISION_MISMATCH', 'INVALID_PRODUCER', 'INVALID_CHECKED_AT', 'INVALID_CHECK', 'INVALID_CHECK_EVIDENCE', 'INCOMPLETE_CHECK_SET'].includes(error.message)
        ? error.message
        : 'REPORT_UNAVAILABLE';
      return { contract: 'agm-production-preflight.v1', environment: 'production', checkedAt, overallStatus: 'ATTENTION', checks: [{ id: 'recovery-procedure', status: 'NOT CONFIGURED', checkedAt, safeDetail: `Raportul runtime de preflight nu este disponibil: ${reason}.` }] };
    }
  }
}
