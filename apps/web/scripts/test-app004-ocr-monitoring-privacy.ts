import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const monitoringFiles = [
  'src/monitoring-department.ts',
  'src/operations-health.ts',
  'src/monitoring/monitoring-event.contract.ts',
  'src/native-diagnostics.ts',
  'src/admin-report.ts',
  'src/admin-incident-report.contract.ts',
];

// These identifiers represent private OCR payloads. Monitoring may report only
// aggregate status/count/duration and controlled error codes.
const forbidden = [
  /ocrExtractedText/i,
  /ocrImageDataUrl/i,
  /extractedText/i,
  /translatedText/i,
  /imageDataUrl/i,
  /documentTitle/i,
  /fileName/i,
  /agm\.ocr\.history\.v1/i,
  /data:image\//i,
  /base64/i,
];

for (const relativePath of monitoringFiles) {
  const source = readFileSync(resolve(root, relativePath), 'utf8');
  for (const pattern of forbidden) {
    assert.doesNotMatch(
      source,
      pattern,
      `${relativePath} must not reference private OCR content (${pattern})`,
    );
  }
}

const runbook = readFileSync(
  resolve(root, '../../evidence/governance/modules/APP-004/v1.0/OCR_ARCHIVE_OPERATIONS_RUNBOOK.md'),
  'utf8',
);
for (const required of [
  /monitorizarea este read-only/i,
  /sunt interzise/i,
  /incident critic/i,
  /fără payload privat/i,
  /nu activați fallback cloud/i,
  /PASS \/ NO-GO/,
]) {
  assert.match(runbook, required, `runbook missing privacy control: ${required}`);
}

console.log('APP-004 OCR archive monitoring privacy: PASS');
