import assert from 'node:assert/strict';
import {
  TURN_REPORT_RECIPIENT,
  adminReportModuleForView,
  buildAdminBugReport,
  buildAdminBugSubject,
  sanitizeTechnicalError,
} from '../src/admin-report';
import {
  createAdminDiagnosticStatus,
  createAdminIncidentReportV1,
} from '../src/admin-incident-report.contract';

const capturedAt = '2026-07-29T10:30:00.000Z';
const incident = createAdminIncidentReportV1({
  source: 'android-diagnostics',
  category: 'Translator',
  description: 'Translator inactive token=secret-value',
  occurredAt: capturedAt,
  application: {
    version: '1.2.4',
    build: '10',
    platform: 'android',
    deviceModel: 'Samsung Test',
    androidVersion: '16 (SDK 36)',
  },
  diagnostics: {
    internet: createAdminDiagnosticStatus('online', 'navigator.onLine', capturedAt, capturedAt),
    api: createAdminDiagnosticStatus('offline', 'health/live', capturedAt, capturedAt),
    ai: createAdminDiagnosticStatus('offline', 'health/ready', null, capturedAt),
    translation: createAdminDiagnosticStatus('offline', 'translation/health', capturedAt, capturedAt),
  },
  lastError: sanitizeTechnicalError(
    'Request failed token=secret-value Bearer abc.def.ghi password=hunter2',
  ),
}, () => 'AGM-INC-STABLE-TEST');
const report = buildAdminBugReport(incident);

assert.equal(TURN_REPORT_RECIPIENT, 'adrianmuscalu2@gmail.com');
assert.equal(buildAdminBugSubject('OCR'), '[AGM BUG ANDROID] OCR');
assert.equal(adminReportModuleForView('cockpit'), 'Translator');
assert.equal(adminReportModuleForView('email'), 'Mail');
assert.match(report, /ID incident: AGM-INC-STABLE-TEST/);
assert.match(report, /Categorie: Translator/);
assert.match(report, /Internet: online · current/);
assert.match(report, /AI: unknown · unknown/);
assert.match(report, /Pași pentru reproducere:/);
assert.match(report, /Atașamente: adăugați manual/);
assert.doesNotMatch(report, /secret-value|abc\.def\.ghi|hunter2/);
assert.doesNotMatch(report, /conținutul mesajului:/i);

console.info('Admin Android report tests: PASS');
