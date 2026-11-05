import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Controlled Playwright/Chromium validation of AGMaTCC against the REAL built API and a disposable loopback PostgreSQL.
// No network stubs: authentication uses the existing /turn-admin/unlock with a locally generated throw-away PIN.
const root = process.cwd();
const databaseUrl = process.env.AGM_E2E_DATABASE_URL;
if (!databaseUrl || !/@(127\.0\.0\.1|localhost):/.test(databaseUrl)) throw new Error('AGM_E2E_DATABASE_URL must target a loopback database.');
const webRequire = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const apiRequire = createRequire(path.join(root, 'apps', 'api', 'package.json'));
const bcrypt = apiRequire('bcryptjs');
const { PrismaClient } = apiRequire('@prisma/client');
const { JwtService } = apiRequire('@nestjs/jwt');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'agmatcc-real-api', runId);
const checks = [];
const report = { schemaVersion: 1, runId, runner: 'Controlled AGM Playwright/Chromium (real API + real PostgreSQL, no route stubs)', browserPluginStatus: 'PASS', integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE', browserSessionStatus: 'FAIL', targetPageStatus: 'FAIL', checks };
const check = (name, ok, detail) => checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
const turnCompanyId = '00000000-0000-0000-0000-000000000001';
let viteServer; let browser; let api; let fatal; let prisma;

await mkdir(out, { recursive: true });
try {
  const apiPort = await freePort();
  const webPort = await freePort();
  const origin = `http://127.0.0.1:${webPort}`;
  const pin = String(100000 + (randomBytes(4).readUInt32BE() % 900000));
  const jwtSecret = randomBytes(32).toString('hex');
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await prisma.company.upsert({ where: { id: turnCompanyId }, update: {}, create: { id: turnCompanyId, companyName: 'AGM TURN isolated e2e', countryCode: 'DE', defaultCurrencyCode: 'EUR' } });
  await prisma.turnAdminSession.deleteMany();
  await prisma.turnAdminCredential.deleteMany();
  const eventsBefore = await prisma.operationalEvent.count({ where: { companyId: turnCompanyId } });

  api = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(root, 'apps', 'api'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(apiPort), API_HOST: '127.0.0.1', DATABASE_URL: databaseUrl, JWT_SECRET: jwtSecret, OPENAI_API_KEY: 'local-e2e-not-used', CORS_ALLOWED_ORIGINS: origin, AGM_TURN_ADMIN_PIN_HASH: await bcrypt.hash(pin, 10) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let apiLog = '';
  api.stdout.on('data', (d) => { apiLog += d; });
  api.stderr.on('data', (d) => { apiLog += d; });
  const base = `http://127.0.0.1:${apiPort}/api/v1`;
  for (let i = 0; i < 60; i += 1) {
    if ((await fetch(`${base}/health`).catch(() => null))?.ok) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  check('Real API process healthy', (await fetch(`${base}/health`).catch(() => null))?.status === 200);

  process.env.VITE_AGM_API_BASE_URL = base;
  const { createServer: createViteServer } = await import(pathToFileURL(webRequire.resolve('vite')).href);
  viteServer = await createViteServer({ root: path.join(root, 'apps', 'web'), server: { host: '127.0.0.1', port: webPort, strictPort: true }, logLevel: 'silent' });
  await viteServer.listen();
  report.target = origin;
  browser = await chromium.launch({ headless: true });
  report.browserSessionStatus = 'PASS';
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ro-RO', serviceWorkers: 'block' });
  const page = await context.newPage();
  globalThis.__page = page;
  const errors = [];
  const failedCss = [];
  const syncCalls = [];
  const journalCalls = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('response', async (response) => {
    const url = response.url();
    if (/\.css(\?|$)/.test(url) && response.status() >= 400) failedCss.push(`${response.status()} ${url}`);
    if (/\/operational-events\/sync$/.test(url)) syncCalls.push({ status: response.status(), body: response.request().postData() ?? '' });
    else if (/\/operational-events\/[^/?]+/.test(url)) journalCalls.push({ status: response.status(), url, auth: Boolean(response.request().headers().authorization) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });
  const response = await page.goto(`${origin}/turn`, { waitUntil: 'domcontentloaded' });
  report.targetPageStatus = response?.status() === 200 ? 'PASS' : 'FAIL';

  // Authentication through the real API; the application then reads its own session storage entry.
  const wrong = await page.evaluate(async (b) => (await fetch(`${b}/turn-admin/unlock`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '000000' }) })).status, base);
  check('Wrong PIN rejected by real API', wrong === 401, { status: wrong });
  const unlock = await page.evaluate(async ({ b, p }) => {
    const r = await fetch(`${b}/turn-admin/unlock`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: p }) });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.data?.accessToken) sessionStorage.setItem('agm.admin.session', JSON.stringify(j.data));
    return { status: r.status, ok: Boolean(j?.data?.accessToken) };
  }, { b: base, p: pin });
  check('Authenticated through existing /turn-admin/unlock', unlock.status < 300 && unlock.ok, { status: unlock.status });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#turn-agmatcc-title', { timeout: 20000 });
  check('No CSS 4xx/5xx', failedCss.length === 0, failedCss);
  await page.screenshot({ path: path.join(out, '01-authenticated.png'), fullPage: true });

  const draft = page.locator('[data-agmatcc-draft]').first();
  const phrase = 'Intrare reala API AGMaTCC \u0103\u00e2\u00ee\u0219\u021b';
  await draft.fill(phrase);
  await page.locator('[data-agmatcc-confirm]').first().click();
  await page.waitForTimeout(500);
  await draft.fill('A doua intrare reala');
  await page.locator('[data-agmatcc-confirm]').first().click();
  await page.waitForTimeout(500);
  check('Entries confirmed in history', (await page.locator('[data-agmatcc-history]').first().innerText()).includes('Intrare reala API'));

  // Wait for the application to perform its real authenticated sync.
  for (let i = 0; i < 20 && !syncCalls.some((c) => c.status < 300); i += 1) {
    await page.waitForTimeout(500);
  }
  const okSync = syncCalls.filter((c) => c.status >= 200 && c.status < 300);
  check('Application sync accepted by real API (2xx)', okSync.length > 0, { statuses: syncCalls.map((c) => c.status) });
  const streamId = /"aggregateId"\s*:\s*"([0-9a-f-]{36})"/i.exec(okSync[0]?.body ?? '')?.[1] ?? null;
  check('Sync payload carries a stream id', typeof streamId === 'string', { streamId });

  await draft.fill('comanda citeste jurnal server');
  await page.locator('[data-agmatcc-run-command]').first().click();
  await page.waitForTimeout(1500);
  const statusText = await page.locator('[data-agmatcc-status]').first().innerText();
  check('Journal read through real authenticated GET', journalCalls.some((c) => c.status === 200 && c.auth) && /Jurnal server/.test(statusText), { journalCalls: journalCalls.map((c) => c.status), statusText });
  await page.screenshot({ path: path.join(out, '02-synced-and-read.png'), fullPage: true });

  if (streamId) {
    const persisted = (await prisma.operationalEvent.count({ where: { companyId: turnCompanyId } })) - eventsBefore;
    check('Events persisted in PostgreSQL for the TURN company', persisted >= 2, { persisted });
    const anon = await page.evaluate(async ({ b, s }) => (await fetch(`${b}/operational-events/${s}?afterVersion=-1`)).status, { b: base, s: streamId });
    check('Anonymous read rejected (401)', anon === 401, { status: anon });
    const company = await prisma.company.create({ data: { companyName: 'e2e-browser-other', countryCode: 'DE', defaultCurrencyCode: 'EUR' } });
    const user = await prisma.user.create({ data: { companyId: company.id, displayName: 'e2e browser other', email: `e2e-b-${Date.now()}@example.invalid`, passwordHash: 'not-a-login' } });
    const token = await new JwtService({ secret: jwtSecret }).signAsync({ sub: user.id, companyId: company.id, roles: [], scope: 'user' }, { expiresIn: '5m' });
    const cross = await page.evaluate(async ({ b, s, t }) => { const r = await fetch(`${b}/operational-events/${s}?afterVersion=-1`, { headers: { Authorization: `Bearer ${t}` } }); const j = await r.json().catch(() => null); return { status: r.status, events: j?.data?.events?.length ?? null, serverVersion: j?.data?.serverVersion ?? null }; }, { b: base, s: streamId, t: token });
    check('Other-company user cannot read the TURN stream', cross.status === 200 && cross.events === 0 && cross.serverVersion === -1, cross);
    const write = await page.evaluate(async ({ b }) => { const t = JSON.parse(sessionStorage.getItem('agm.admin.session') ?? '{}').accessToken; const r = await fetch(`${b}/operational-events/sync`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [] }) }); return r.status; }, { b: base });
    check('TURN session sync right honored (empty batch not 401/403)', write !== 401 && write !== 403, { status: write });
  }

  await draft.fill('');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-agmatcc-history]', { timeout: 20000 });
  check('History persists across reload', (await page.locator('[data-agmatcc-history]').first().innerText()).includes('Intrare reala API'));
  const unexpected = errors.filter((e) => !/Failed to fetch/.test(e));
  check('No page runtime errors', unexpected.length === 0, { unexpected });
  report.apiLogTail = apiLog.slice(-1500);
} catch (error) {
  fatal = error instanceof Error ? error.stack : String(error);
  await globalThis.__page?.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
} finally {
  await browser?.close();
  await viteServer?.close();
  api?.kill();
  await prisma?.$disconnect().catch(() => {});
  report.status = !fatal && checks.every((c) => c.status === 'PASS') && report.targetPageStatus === 'PASS' ? 'PASS' : 'FAIL';
  report.fatal = fatal;
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, out, checks: checks.map((c) => `${c.status} ${c.name}`), fatal }, null, 2));
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}
