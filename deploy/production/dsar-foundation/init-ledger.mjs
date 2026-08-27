import { createHmac, randomUUID } from 'node:crypto';
import { open, stat } from 'node:fs/promises';

const path = process.env.DSAR_SUPPRESSION_LEDGER_PATH;
const encodedKey = process.env.DSAR_SUPPRESSION_LEDGER_KEY;
if (!path || !encodedKey) throw new Error('DSAR_LEDGER_CONFIGURATION_MISSING');
const key = Buffer.from(encodedKey, 'base64');
if (key.length < 32) throw new Error('DSAR_LEDGER_KEY_INVALID');
try {
  await stat(path);
  throw new Error('DSAR_LEDGER_ALREADY_EXISTS_FAIL_CLOSED');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
const unsigned = {
  version: 1,
  eventId: randomUUID(),
  subjectPseudonym: '0'.repeat(64),
  action: 'COMPACTION_CHECKPOINT',
  effectiveAt: new Date().toISOString(),
  categories: [],
  status: 'APPLIED',
  applicationEvidence: 'DSAR_FOUNDATION_INITIALIZED_NO_SUBJECT_DATA',
  previousMac: 'GENESIS',
};
const record = {
  ...unsigned,
  mac: createHmac('sha256', key).update(JSON.stringify(unsigned)).digest('hex'),
};
const handle = await open(path, 'wx', 0o600);
try {
  await handle.writeFile(`${JSON.stringify(record)}\n`);
  await handle.sync();
} finally {
  await handle.close();
}
process.stdout.write('{"ledger_initialized":true,"records":1,"personal_records":0}\n');

