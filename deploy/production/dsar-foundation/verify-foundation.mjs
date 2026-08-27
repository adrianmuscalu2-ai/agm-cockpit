import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const ledgerPath = process.env.DSAR_SUPPRESSION_LEDGER_PATH;
const exportDir = process.env.DSAR_EXPORT_DIR;
const encodedKey = process.env.DSAR_SUPPRESSION_LEDGER_KEY;
if (!ledgerPath || !exportDir || !encodedKey) throw new Error('DSAR_FOUNDATION_CONFIGURATION_MISSING');
if (process.env.RETENTION_ENGINE_ENABLED === 'true' || process.env.RETENTION_EXECUTE === 'true') {
  throw new Error('RETENTION_MUST_REMAIN_DISABLED');
}
const key = Buffer.from(encodedKey, 'base64');
if (key.length < 32) throw new Error('DSAR_LEDGER_KEY_INVALID');
const exportInfo = await stat(exportDir);
if (!exportInfo.isDirectory()) throw new Error('DSAR_EXPORT_PATH_NOT_DIRECTORY');
const ledgerInfo = await stat(ledgerPath);
if (!ledgerInfo.isFile()) throw new Error('DSAR_LEDGER_PATH_NOT_FILE');
const lines = (await readFile(ledgerPath, 'utf8')).trim().split(/\r?\n/);
if (!lines.length || !lines[0]) throw new Error('DSAR_LEDGER_EMPTY');
let previousMac = 'GENESIS';
for (const [index, line] of lines.entries()) {
  const record = JSON.parse(line);
  const unsigned = {
    version: record.version,
    eventId: record.eventId,
    subjectPseudonym: record.subjectPseudonym,
    action: record.action,
    effectiveAt: record.effectiveAt,
    categories: record.categories,
    status: record.status,
    applicationEvidence: record.applicationEvidence,
    previousMac: record.previousMac,
  };
  if (record.previousMac !== previousMac || !/^[a-f0-9]{64}$/.test(record.mac ?? '')) {
    throw new Error(`DSAR_LEDGER_CHAIN_INVALID_AT_${index + 1}`);
  }
  const expected = createHmac('sha256', key).update(JSON.stringify(unsigned)).digest('hex');
  if (!timingSafeEqual(Buffer.from(record.mac, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new Error(`DSAR_LEDGER_MAC_INVALID_AT_${index + 1}`);
  }
  previousMac = record.mac;
}
process.stdout.write(JSON.stringify({
  foundation: 'PASS',
  ledgerRecords: lines.length,
  exportDirectory: 'READY_EMPTY_OR_CONTROLLED',
  retentionJobs: 'DISABLED',
  secretValueExposed: false,
}) + '\n');

