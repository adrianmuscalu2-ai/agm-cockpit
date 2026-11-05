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
const jwtSecret = randomBytes(32).toString('hex');
const turnScope = 'turn-admin';
const turnCompanyId = '00000000-0000-0000-0000-000000000001';
const checks = [];
{
  // Disposable loopback database only: clear any previous throw-away TURN credential so this run's PIN is accepted.
  const { PrismaClient } = requireFromApi('@prisma/client');
  const reset = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await reset.company.upsert({ where: { id: turnCompanyId }, update: {}, create: { id: turnCompanyId, companyName: 'AGM TURN isolated e2e', countryCode: 'DE', defaultCurrencyCode: 'EUR' } });
  await reset.turnAdminSession.deleteMany();
  await reset.turnAdminCredential.deleteMany();
  await reset.$disconnect();
}
const check = (name, ok, detail) => checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });

const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: path.join(root, 'apps/api'),
  env: {
    ...process.env, NODE_ENV: 'development', PORT: String(port), API_HOST: '127.0.0.1', DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret, OPENAI_API_KEY: 'local-e2e-not-used',
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
  const read = await json(`${base}/operational-events/${streamIds.streamId}?afterVersion=-1`, { headers: auth });
  check('Authenticated journal read returns persisted events', read.status === 200 && read.body?.data?.events?.length === items.length, { status: read.status, count: read.body?.data?.events?.length, serverVersion: read.body?.data?.serverVersion });
  const replay = await json(`${base}/operational-events/sync`, { method: 'POST', headers: auth, body: JSON.stringify({ events: items }) });
  const replayResults = replay.body?.data?.results ?? [];
  check('Replay is idempotent (no duplicate append)', replay.status < 300 && replayResults.every((r) => r.status !== 'accepted'), { status: replay.status, results: replayResults.map((r) => r.status) });

  // Cross-company isolation and token-type separation, using a second company and a user token signed by the real secret.
  const { PrismaClient } = requireFromApi('@prisma/client');
  const { JwtService } = requireFromApi('@nestjs/jwt');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const company = await prisma.company.create({ data: { companyName: 'e2e-other-company', countryCode: 'DE', defaultCurrencyCode: 'EUR' } });
    const user = await prisma.user.create({ data: { companyId: company.id, displayName: 'e2e other user', email: `e2e-${Date.now()}@example.invalid`, passwordHash: 'not-a-login' } });
    const jwt = new JwtService({ secret: jwtSecret });
    const userToken = await jwt.signAsync({ sub: user.id, companyId: company.id, roles: [], scope: 'user' }, { expiresIn: '5m' });
    const other = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };
    const crossRead = await json(`${base}/operational-events/${streamIds.streamId}?afterVersion=-1`, { headers: other });
    check('Other company cannot read TURN-company stream', crossRead.status === 200 && crossRead.body?.data?.serverVersion === -1 && crossRead.body?.data?.events?.length === 0, { status: crossRead.status, serverVersion: crossRead.body?.data?.serverVersion });
    const otherStream = { streamId: randomUuid(), deviceId: randomUuid() };
    const otherLedger = await appendAgmatccEntry([], { kind: 'note', provenance: 'typed', text: 'Intrare companie separata', language: 'ro-RO', actorId: 'other-user' });
    const otherItems = toOperationalSyncItems(otherLedger, otherStream, 0);
    const otherSync = await json(`${base}/operational-events/sync`, { method: 'POST', headers: other, body: JSON.stringify({ events: otherItems }) });
    check('Other company user sync stays inside its own company', otherSync.status < 300, { status: otherSync.status });
    const leak = await json(`${base}/operational-events/${otherStream.streamId}?afterVersion=-1`, { headers: auth });
    check('TURN session cannot read other company stream', leak.status === 200 && leak.body?.data?.serverVersion === -1 && leak.body?.data?.events?.length === 0, { status: leak.status, serverVersion: leak.body?.data?.serverVersion });
    const ownRead = await json(`${base}/operational-events/${otherStream.streamId}?afterVersion=-1`, { headers: other });
    check('Other company reads its own stream', ownRead.status === 200 && ownRead.body?.data?.events?.length === otherItems.length, { status: ownRead.status, count: ownRead.body?.data?.events?.length });

    const ghost = await jwt.signAsync({ sub: randomUuid(), companyId: company.id, roles: [], scope: 'user' }, { expiresIn: '5m' });
    const ghostRead = await json(`${base}/operational-events/${streamIds.streamId}`, { headers: { Authorization: `Bearer ${ghost}` } });
    check('User token for unknown user rejected with 401', ghostRead.status === 401, { status: ghostRead.status });
    const wrongScope = await jwt.signAsync({ scope: 'something-else' }, { expiresIn: '5m' });
    const wrongScopeRead = await json(`${base}/operational-events/${streamIds.streamId}`, { headers: { Authorization: `Bearer ${wrongScope}` } });
    check('Token with foreign scope and no subject rejected with 401', wrongScopeRead.status === 401, { status: wrongScopeRead.status });
    const forgedTurn = await new JwtService({ secret: randomBytes(32).toString('hex') }).signAsync({ scope: turnScope, sid: randomUuid(), familyId: randomUuid(), generation: 0 }, { expiresIn: '5m' });
    const forgedRead = await json(`${base}/operational-events/${streamIds.streamId}`, { headers: { Authorization: `Bearer ${forgedTurn}` } });
    check('Forged TURN token (wrong signature) rejected', forgedRead.status === 401, { status: forgedRead.status });
    const unboundTurn = await jwt.signAsync({ scope: turnScope, sid: randomUuid(), familyId: randomUuid(), generation: 0 }, { expiresIn: '5m' });
    const unboundRead = await json(`${base}/operational-events/${streamIds.streamId}`, { headers: { Authorization: `Bearer ${unboundTurn}` } });
    check('Correctly signed TURN token without a live session rejected', unboundRead.status === 401, { status: unboundRead.status });
  } finally {
    await prisma.$disconnect();
  }
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
