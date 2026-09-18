import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const workspace = process.cwd();
const directory = mkdtempSync(join(workspace, '.tmp-evidence-sanitizer-'));
const source = join(directory, 'capture.txt');
const captured = join(directory, 'captured.txt');
const googleKey = ['AI', 'za', 'A'.repeat(35)].join('');
const jwt = [`eyJ${'A'.repeat(12)}`, 'B'.repeat(16), 'C'.repeat(16)].join('.');
const authorization = `Authorization: Bearer ${'D'.repeat(32)}`;
const raw = `${googleKey}\n${jwt}\n${authorization}\n`;

try {
  writeFileSync(source, raw, 'utf8');
  const failed = spawnSync(process.execPath, ['scripts/evidence-sanitizer.mjs', '--check', source], { cwd: workspace, encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert(!failed.stdout.includes(googleKey));
  assert(!failed.stdout.includes(jwt));
  assert(!failed.stdout.includes('D'.repeat(32)));

  const sanitized = execFileSync(process.execPath, ['scripts/evidence-sanitizer.mjs', '--sanitize', source], { cwd: workspace, encoding: 'utf8' });
  assert.match(sanitized, /"result": "PASS"/);
  assert(!readFileSync(source, 'utf8').includes(googleKey));

  const capture = spawnSync(process.execPath, ['scripts/evidence-sanitizer.mjs', '--stdin', '--output', captured], { cwd: workspace, input: raw, encoding: 'utf8' });
  assert.equal(capture.status, 0);
  assert(!readFileSync(captured, 'utf8').includes(googleKey));
  assert.match(readFileSync(captured, 'utf8'), /REDACTED_GOOGLE_API_KEY/);

  process.stdout.write(JSON.stringify({ contract: 'agm-evidence-sanitizer-test.v1', result: 'PASS', rawSecretPrinted: false }) + '\n');
} finally {
  rmSync(directory, { recursive: true, force: true });
}