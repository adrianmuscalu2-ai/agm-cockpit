import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'operational-linguist-v1', 'browser', runId);
const requests = [];
const legacyAttempts = [];
const pageErrors = [];
let server;
let browser;
let target = '';
let fatal = null;

const components = ['it', 'es', 'sv'].map((language) => ({
  componentId: `premium-linguist-${language}`,
  language,
  operationalState: 'ONLINE',
  current: true,
  observedAt: '2026-09-23T06:00:00.000Z',
}));

await mkdir(output, { recursive: true });
try {
  const port = await freePort();
  const vite = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
  server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps', 'web'),
    windowsHide: true,
    stdio: 'ignore',
  });
  target = `http://127.0.0.1:${port}/turn`;
  await waitForTarget(target);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'ro-RO', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'controlled-operational-linguist-v1-browser' }) });
    if (pathname.endsWith('/turn-admin/refresh')) return json({ accessToken: 'controlled-browser-observer-session', expiresInSeconds: 600 });
    if (pathname.endsWith('/turn-admin/validate')) return json({ valid: true });
    if (pathname.endsWith('/operations/turn/operational-linguists/state')) {
      requests.push({ method: request.method(), pathname, authenticated: request.headers().authorization === 'Bearer controlled-browser-observer-session' });
      return json({ baselineVersion: 'agm.operational-linguist.v1', status: 'ACTIVE', components });
    }
    if (/\/operations\/(?:turn\/)?components\/premium-linguist-(?:it|es|sv)\/heartbeat$/.test(pathname)) {
      legacyAttempts.push({ method: request.method(), pathname });
      return json({ code: 'LEGACY_OPERATIONAL_LINGUIST_HEARTBEAT_FENCED' }, 409);
    }
    if (pathname.endsWith('/health/live')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    if (pathname.endsWith('/health/ready')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', dependencies: {} }) });
    if (pathname.includes('/api/v1/')) return json([]);
    return route.continue();
  });

  const firstPage = await context.newPage();
  firstPage.on('pageerror', (error) => pageErrors.push(error.message));
  const firstNavigation = await firstPage.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(firstNavigation?.status() === 200, `Initial target HTTP ${firstNavigation?.status()}`);
  await firstPage.waitForFunction(() => {
    const entries = JSON.parse(localStorage.getItem('agm.turn.telemetry-snapshots.v1') ?? '[]');
    return ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv'].every((id) => entries.some(([entryId, value]) => entryId === id && value.status === 'ONLINE' && value.reason === 'V1_CANONICAL_STATE_OBSERVED'));
  }, undefined, { timeout: 30_000 });
  await firstPage.locator('body').screenshot({ path: path.join(output, 'v1-observer-initial.png') });
  await firstPage.close();

  const reopenedPage = await context.newPage();
  reopenedPage.on('pageerror', (error) => pageErrors.push(error.message));
  const reopenNavigation = await reopenedPage.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(reopenNavigation?.status() === 200, `Reopened target HTTP ${reopenNavigation?.status()}`);
  await reopenedPage.waitForFunction(() => {
    const entries = JSON.parse(localStorage.getItem('agm.turn.telemetry-snapshots.v1') ?? '[]');
    return ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv'].every((id) => entries.some(([entryId, value]) => entryId === id && value.status === 'ONLINE' && value.reason === 'V1_CANONICAL_STATE_OBSERVED'));
  }, undefined, { timeout: 30_000 });
  await reopenedPage.locator('[data-turn-page-target="premium"]').click();
  await reopenedPage.waitForSelector('[data-turn-page="premium"]:not([hidden])', { timeout: 15_000 });
  await reopenedPage.screenshot({ path: path.join(output, 'v1-observer-after-reopen.png'), fullPage: true });

  assert(requests.length >= 2, `Expected observer state GET after initial load and reopen, got ${requests.length}`);
  assert(requests.every((request) => request.method === 'GET' && request.authenticated), 'V1 observer request was not an authenticated GET');
  assert(legacyAttempts.length === 0, `Legacy browser heartbeat attempts detected: ${JSON.stringify(legacyAttempts)}`);
  assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
  await context.close();
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await browser?.close();
  server?.kill();
  const report = {
    schemaVersion: 1,
    runId,
    status: fatal ? 'FAIL' : 'PASS',
    runner: 'Controlled AGM Playwright/Chromium',
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: fatal ? 'FAIL' : 'PASS',
    targetPageStatus: fatal ? 'FAIL' : 'PASS',
    target,
    probe: 'TURN -> Owner/session restore -> V1 state observation -> close/reopen -> Premium navigation -> capture',
    browserAuthority: 'NONE',
    observerRequests: requests,
    legacyAttempts,
    pageErrors,
    fatal,
    finishedAt: new Date().toISOString(),
  };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ report: path.join(output, 'report.json'), ...report }, null, 2));
  if (fatal) process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForTarget(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(url)).status === 200) return;
    } catch { /* controlled startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('CONTROLLED_TARGET_UNAVAILABLE');
}
