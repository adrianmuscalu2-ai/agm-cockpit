import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ADMIN_INCIDENT_REPORT_VERSION,
  adminIncidentCategories,
  createAdminDiagnosticStatus,
  createAdminIncidentReportV1,
} from '../src/admin-incident-report.contract';
import { buildAdminBugReport } from '../src/admin-report';

assert.deepEqual([...adminIncidentCategories], [
  'Translator',
  'AI',
  'API',
  'OCR',
  'Mail',
  'Alt incident',
]);

const now = '2026-07-29T12:00:00.000Z';
const report = createAdminIncidentReportV1({
  source: 'android-diagnostics',
  category: 'API',
  description: 'API unavailable token=private-value admin@example.com',
  occurredAt: now,
  application: {
    version: '1.2.9',
    build: '20',
    platform: 'android',
    deviceModel: 'Test device',
    androidVersion: '16',
  },
  diagnostics: {
    internet: createAdminDiagnosticStatus('online', 'navigator.onLine', now, now),
    api: createAdminDiagnosticStatus('offline', 'health/live', now, now),
    ai: createAdminDiagnosticStatus(
      'offline',
      'health/ready',
      '2026-07-29T11:55:00.000Z',
      now,
    ),
    translation: createAdminDiagnosticStatus('checking', 'translation/health', null, now),
  },
  lastError: 'Bearer abc.def.ghi password=hunter2',
}, () => 'AGM-INC-STABLE-ID');

assert.equal(report.contractVersion, ADMIN_INCIDENT_REPORT_VERSION);
assert.equal(report.incidentId, 'AGM-INC-STABLE-ID');
assert.equal(report.source, 'android-diagnostics');
assert.equal(report.diagnostics.internet.freshness, 'current');
assert.equal(report.diagnostics.ai.freshness, 'stale');
assert.deepEqual(report.diagnostics.translation, {
  value: 'unknown',
  freshness: 'unknown',
  source: 'translation/health',
  capturedAt: null,
});
assert.throws(
  () => createAdminIncidentReportV1({ ...report, description: '   ', lastError: '' }),
  /ADMIN_INCIDENT_DESCRIPTION_REQUIRED/,
);

const message = buildAdminBugReport(report);
assert.match(message, /Contract: admin-incident-report\.v1/);
assert.match(message, /ID incident: AGM-INC-STABLE-ID/);
assert.match(message, /AI: offline · stale/);
assert.doesNotMatch(message, /private-value|admin@example\.com|abc\.def\.ghi|hunter2/);

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.match(main, /if \(!\(await authorizeAdminIncidentAccess\(\)\)\) return;/);
assert.match(main, /state\.adminAccessVerified = false;/);
assert.match(main, /window\.sessionStorage\.removeItem\(ADMIN_SESSION_KEY\)/);
assert.match(main, /navigateToModule\('turn'\)/);
assert.match(main, /adminReportDescription/);
assert.match(main, /Descrierea incidentului este obligatorie/);
assert.match(main, /collectSafeTechnicalDiagnostics/);

console.info('SR-06 Android AdminIncidentReportV1 hardening: PASS');
