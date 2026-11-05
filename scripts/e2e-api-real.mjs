import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Real-API e2e: boots the built API against a disposable loopback PostgreSQL, authenticates through the existing
// /turn-admin/unlock mechanism with a locally generated throw-away PIN, then syncs and reads an AGMaTCC stream.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.AGM_E2E_DATABASE_URL;
if (!databaseUrl || !/@(127\.0\.0\.1|localhost):/.test(databaseUrl)) throw new Error('AGM_E2E_DATABASE_URL must target a loopback database.');
const requireFromApi = createRequire(path.join(root, 'apps/api/package.json'));
const bcrypt = requireFromApi('bcryptjs');
const { appendAgmatccEntry, toOperationalSyncItems, randomUuid } = await import(new URL('../apps/web/src/turn-agmatcc/agmatcc.ledger.ts', import.meta.url).href);

const pin = String(100000 + (randomBytes(4).readUInt32BE() % 900000));
const port = 39000 + (randomBytes(2).readUInt16BE() % 500);
const base = `http://127.0.0.1:${port}/api/v1`;
const checks = [];
const check = (name, ok, detail) => checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });

const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: path.join(root, 'apps/api'),
  env: {
    ...process.env, NODE_ENV: 'development', PORT: String(port), API_HOST: '127.0.0.1', DATABASE_URL: databaseUrl,
    JWT_SECRET: randomBytes(32).toString('hex'), OPENAI_API_KEY: 'local-e2e-not-used',
    CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5173', AGM_TURN_ADMIN_PIN_HASH: await bcrypt.hash(pin, 10),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
api.stdout.on('data', (d) => { log += d; });
api.stderr.on('data', (d) => { log += d; });

const json = async (url, init) => { const r = await fetch(url, init); return { status: r.status, body: await r.json().catch(() => null) }; };
let fatal = null;
try {
  for (let i = 0; i < 60; i += 1) {
    if ((await fetch(`${base}/health`).catch(() => null))?.ok) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const health = await fetch(`${base}/health`).catch(() => null);
  check('API booted (real process, real DB)', health?.status === 200, { status: health?.status });

  const anon = await json(`${base}/operational-events/${randomUuid()}`);
  check('Unauthenticated journal read rejected', anon.status === 401, { status: anon.status });
  const bad = await json(`${base}/turn-admin/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '000000' }) });
  check('Wrong PIN rejected', bad.status === 401, { status: bad.status });
  const unlock = await json(`${base}/turn-admin/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
  const token = unlock.body?.data?.accessToken;
  check('Authenticated through existing /turn-admin/unlock', unlock.status < 300 && Boolean(token), { status: unlock.status });
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const streamIds = { streamId: randomUuid(), deviceId: randomUuid() };
  let ledger = [];
  for (const text of ['Prima intrare AGMaTCC e2e', 'A doua intrare AGMaTCC e2e']) {
    ledger = await appendAgmatccEntry(ledger, { kind: 'note', provenance: 'typed', text, language: 'ro-RO', actorId: 'turn-admin-session' });
  }
  const items = toOperationalSyncItems(ledger, streamIds, 0);
  const sync = await json(`${base}/operational-events/sync`, { method: 'POST', headers: auth, body: JSON.stringify({ events: items }) });
  const results = sync.body?.data?.results ?? [];
  check('Authenticated sync accepted all entries', sync.status < 300 && results.length === items.length && results.every((r) => r.status !== 'conflict' && r.status !== 'rejected'), { status: sync.status, results: results.map((r) => r.status) });
  const read = await json(`${base}/operational-events/${streamIds.streamId}?afterVersion=0`, { headers: auth });
  check('Authenticated journal read returns persisted events', read.status === 200 && read.body?.data?.events?.length === items.length, { status: read.status, count: read.body?.data?.events?.length, serverVersion: read.body?.data?.serverVersion });
  const replay = await json(`${base}/operational-events/sync`, { method: 'POST', headers: auth, body: JSON.stringify({ events: items }) });
  const replayResults = replay.body?.data?.results ?? [];
  check('Replay is idempotent (no duplicate append)', replay.status < 300 && replayResults.every((r) => r.status !== 'accepted'), { status: replay.status, results: replayResults.map((r) => r.status) });
} catch (error) {
  fatal = error instanceof Error ? error.stack : String(error);
} finally {
  api.kill();
  const status = !fatal && checks.length > 0 && checks.every((c) => c.status === 'PASS') ? 'PASS' : 'FAIL';
  const out = path.join(root, 'evidence', 'api-real');
  await mkdir(out, { recursive: true });
  const report = { status, at: new Date().toISOString(), checks, fatal, apiLogTail: status === 'PASS' ? undefined : log.replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter((l) => /Invalid|does not exist|Unknown|P\d{4}|Error|denied/.test(l)).slice(0, 12).join('\n') };
  await writeFile(path.join(out, `report-${Date.now()}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = status === 'PASS' ? 0 : 1;
}
