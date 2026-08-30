import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registryPath = path.join(root, 'AGM_LIBRARY', 'REGISTRY', 'canonical-sources.json');
const snapshotPath = path.join(root, 'AGM_LIBRARY', 'PHASE3', 'CENTRAL_REGISTRY_APPLY', 'PRE_APPLY_CANONICAL_SOURCES.json');
const recordPath = path.join(root, 'AGM_LIBRARY', 'PHASE3', 'CENTRAL_REGISTRY_APPLY', 'APPLY_EXECUTION_RECORD.json');
const expectedBeforeHash = '1c506707200d6c8b27217cdf00d00541a739ef5321bde1e5f892cb9098e61a34';

assert(existsSync(snapshotPath), 'ROLLBACK_SNAPSHOT_MISSING');
assert(existsSync(recordPath), 'APPLY_RECORD_MISSING');
const snapshot = readFileSync(snapshotPath);
const record = JSON.parse(readFileSync(recordPath, 'utf8'));
const current = readFileSync(registryPath);
assert(hash(snapshot) === expectedBeforeHash, 'ROLLBACK_SNAPSHOT_HASH_MISMATCH');
assert(hash(current) === record.after.sha256, 'ROLLBACK_REFUSED_CURRENT_STATE_NOT_EXACT_APPLIED_STATE');

const tempPath = path.join(root, 'AGM_LIBRARY', 'REGISTRY', '.canonical-sources.phase3-rollback.tmp');
writeFileSync(tempPath, snapshot);
assert(hash(readFileSync(tempPath)) === expectedBeforeHash, 'ROLLBACK_TEMP_HASH_MISMATCH');
renameSync(tempPath, registryPath);

const restored = JSON.parse(readFileSync(registryPath, 'utf8'));
assert(restored.sourceCount === 798 && restored.sources.length === 798, 'ROLLBACK_COUNT_MISMATCH');
assert(hash(readFileSync(registryPath)) === expectedBeforeHash, 'ROLLBACK_FINAL_HASH_MISMATCH');
console.log('ROLLBACK=PASS');
console.log('CENTRAL_REGISTRY_COUNT=798');
console.log(`CENTRAL_REGISTRY_SHA256=${expectedBeforeHash}`);

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function assert(value, message) { if (!value) throw new Error(message); }
