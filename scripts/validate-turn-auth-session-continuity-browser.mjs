import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { chromium } from 'playwright';

const root = process.cwd();
const requireFromApi = createRequire(resolve(root, 'apps/api/package.json'));
const requireFromWeb = createRequire(resolve(root, 'apps/web/package.json'));
const bcrypt = requireFromApi('bcryptjs');
const viteEntrypoint = resolve(dirname(requireFromWeb.resolve('vite/package.json')), 'bin/vite.js');
const durationMinutes = Number(process.env.AGM_AUTH_SOAK_MINUTES ?? '30');
const cycleIntervalMs = Number(process.env.AGM_AUTH_CYCLE_INTERVAL_MS ?? '15100');
const accessTtlSeconds = Number(process.env.AGM_AUTH_TEST_ACCESS_TTL_SECONDS ?? '2');
const reloadEvery = Number(process.env.AGM_AUTH_RELOAD_EVERY ?? '8');
const reopenEvery = Number(process.env.AGM_AUTH_REOPEN_EVERY ?? '20');
const apiPort = Number(process.env.AGM_AUTH_API_PORT ?? '3107');
const webPort = Number(process.env.AGM_AUTH_WEB_PORT ?? '5187');
const apiTlsPort = Number(process.env.AGM_AUTH_API_TLS_PORT ?? '3447');
const webTlsPort = Number(process.env.AGM_AUTH_WEB_TLS_PORT ?? '5447');
const browserHost = process.env.AGM_AUTH_BROWSER_HOST ?? 'localhost';
const pin = process.env.AGM_AUTH_TEST_PIN ?? '2468';
const databaseUrl = process.env.AGM_AUTH_TEST_DATABASE_URL
  ?? 'postgresql://agm:agm@127.0.0.1:5432/agm?schema=p0_auth_20260906';
const apiUpstreamOrigin = `http://127.0.0.1:${apiPort}`;
const webUpstreamOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `https://${browserHost}:${apiTlsPort}`;
const webOrigin = `https://${browserHost}:${webTlsPort}`;
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDirectory = resolve(root, 'evidence', 'turn-auth-session-continuity', 'browser', runId);

await mkdir(evidenceDirectory, { recursive: true });
const processes = [];
const servers = [];
let browser;
let page;
let tlsMaterialDirectory;
const startedAt = new Date();
const observations = [];
const responses = [];
const failures = [];
let rotationCycles = 0;
let reloadCycles = 0;
let reopenCycles = 0;
let turnOpenedAt;

try {
  await assertPortsFree([apiPort, webPort, apiTlsPort, webTlsPort]);
  const pinHash = await bcrypt.hash(pin, 10);
  processes.push(startProcess('api', process.execPath, ['apps/api/dist/main.js'], {
    NODE_ENV: 'test',
    PORT: String(apiPort),
    API_HOST: '127.0.0.1',
    TRUST_PROXY_HOPS: '0',
    CORS_ALLOWED_ORIGINS: webOrigin,
    DATABASE_URL: databaseUrl,
    PRISMA_CONNECT_ON_BOOT: 'true',
    JWT_SECRET: 'turn-auth-continuity-local-test-secret-2026',
    OPENAI_API_KEY: 'local-test-not-a-provider-credential',
    AGM_TURN_ADMIN_PIN_HASH: pinHash,
    AGM_TURN_ADMIN_TEST_ACCESS_TTL_SECONDS: String(accessTtlSeconds),
  }));
  processes.push(startProcess('web', process.execPath, [viteEntrypoint, 'apps/web', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], {
    VITE_AGM_API_BASE_URL: `${apiOrigin}/api/v1`,
  }));

  await Promise.all([
    waitForHttp(`${apiUpstreamOrigin}/api/v1/health/live`, 60_000),
    waitForHttp(`${webUpstreamOrigin}/`, 60_000),
  ]);

  const tls = await createTestCertificate();
  servers.push(await startHttpsProxy(apiTlsPort, apiPort, tls));
  servers.push(await startHttpsProxy(webTlsPort, webPort, tls));

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
  page = await context.newPage();
  bindResponseCapture(page);

  await login(page);
  turnOpenedAt = new Date();
  const initialCookie = await assertCookieContract(context);
  const initialAccess = await readAccessFingerprint(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('agm.admin.session')), null, 'Persistent localStorage bearer found');
  await assertTurnSurfaces(page);
  await page.screenshot({ path: join(evidenceDirectory, 'initial-authenticated-turn.png'), fullPage: true });

  let priorCookieHash = fingerprint(initialCookie.value);
  let priorAccessHash = initialAccess;
  const deadline = turnOpenedAt.getTime() + durationMinutes * 60_000;
  let nextCycleAt = Date.now() + Math.max(cycleIntervalMs, (accessTtlSeconds + 1) * 1_000);

  while (Date.now() < deadline) {
    await sleep(Math.max(0, nextCycleAt - Date.now()));
    const cycle = rotationCycles + 1;
    const oldAccessToken = await readAccessToken(page);

    if (cycle % reopenEvery === 0) {
      await page.close();
      page = await context.newPage();
      bindResponseCapture(page);
      const refreshResponse = waitForSuccessfulResponse(page, '/turn-admin/refresh');
      const dashboardResponse = waitForSuccessfulResponse(page, '/operations/turn/operational-dashboard');
      await Promise.all([page.goto(`${webOrigin}/turn`, { waitUntil: 'domcontentloaded' }), refreshResponse, dashboardResponse]);
      reopenCycles += 1;
    } else if (cycle % reloadEvery === 0) {
      const refreshResponse = waitForSuccessfulResponse(page, '/turn-admin/refresh');
      const dashboardResponse = waitForSuccessfulResponse(page, '/operations/turn/operational-dashboard');
      await Promise.all([page.reload({ waitUntil: 'domcontentloaded' }), refreshResponse, dashboardResponse]);
      reloadCycles += 1;
    } else {
      const refreshResponse = waitForSuccessfulResponse(page, '/turn-admin/refresh');
      const dashboardResponse = waitForSuccessfulResponse(page, '/operations/turn/operational-dashboard');
      const concurrentProtectedReads = page.evaluate(async () => {
        const auth = await import('/src/admin-auth.ts');
        const [dashboard, overview] = await Promise.all([
          auth.turnAdminAuthenticatedFetch('/operations/turn/operational-dashboard', { cache: 'no-store' }),
          auth.turnAdminAuthenticatedFetch('/operations/turn/functional-overview', { cache: 'no-store' }),
        ]);
        return { dashboard: dashboard.status, overview: overview.status };
      });
      const [statuses] = await Promise.all([concurrentProtectedReads, refreshResponse, dashboardResponse]);
      assert.deepEqual(statuses, { dashboard: 200, overview: 200 }, `Protected reads failed in cycle ${cycle}`);
    }

    await page.locator('.turn-command-center').waitFor({ state: 'visible' });
    const cookie = await assertCookieContract(context);
    const accessHash = await readAccessFingerprint(page);
    assert.notEqual(accessHash, priorAccessHash, `Access token did not rotate in cycle ${cycle}`);
    assert.notEqual(fingerprint(cookie.value), priorCookieHash, `Refresh token did not rotate in cycle ${cycle}`);
    const oldAccessStatus = await context.request.get(`${apiOrigin}/api/v1/operations/turn/operational-dashboard`, {
      headers: { Authorization: `Bearer ${oldAccessToken}` },
    }).then((response) => response.status());
    assert.equal(oldAccessStatus, 401, `Prior access token remained valid in cycle ${cycle}`);

    await assertTurnSurfaces(page);
    assert.equal(await page.locator('#adminLoginForm').count(), 0, `Manual login loop appeared in cycle ${cycle}`);
    const operationalFailureText = await premiumFailureText(page);
    assert.doesNotMatch(operationalFailureText, /AUTH\/SESSION FAILURE|DATA UNAVAILABLE/i);

    rotationCycles += 1;
    priorAccessHash = accessHash;
    priorCookieHash = fingerprint(cookie.value);
    observations.push({
      cycle: rotationCycles,
      observedAt: new Date().toISOString(),
      refreshRotated: true,
      priorAccessInvalidated: true,
      drillDownAccessible: true,
      manualLoginLoop: false,
      operationalFailureText: operationalFailureText || null,
    });
    if (rotationCycles === 1 || rotationCycles % 2 === 0) {
      process.stdout.write(`${JSON.stringify({ heartbeat: 'TURN_AUTH_SOAK', elapsedMinutes: elapsedMinutes(), rotationCycles, reloadCycles, reopenCycles })}\n`);
    }
    nextCycleAt = Date.now() + cycleIntervalMs;
  }

  await page.screenshot({ path: join(evidenceDirectory, 'final-drill-down-after-rotations.png'), fullPage: true });
  const endedAt = new Date();
  const report = {
    contract: 'agm-turn-auth-session-continuity-browser.v1',
    runId,
    startedAt: startedAt.toISOString(),
    turnOpenedAt: turnOpenedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMinutes: (endedAt.getTime() - turnOpenedAt.getTime()) / 60_000,
    target: webOrigin,
    revision: await revision(),
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: 'PASS',
    targetPageStatus: 'PASS',
    testAccessTtlSeconds: accessTtlSeconds,
    productionAccessTtlUnchangedSeconds: 900,
    rotationCycles,
    reloadCycles,
    reopenCycles,
    checks: {
      tokenRotation: rotationCycles > 1 ? 'PASS' : 'FAIL',
      silentRefresh: rotationCycles > 1 ? 'PASS' : 'FAIL',
      sessionContinuity: rotationCycles > 1 ? 'PASS' : 'FAIL',
      reloadContinuity: reloadCycles > 0 ? 'PASS' : 'FAIL',
      reopenContinuity: reopenCycles > 0 ? 'PASS' : 'FAIL',
      premiumDrillDownAfterTokenExpiry: rotationCycles > 1 ? 'PASS' : 'FAIL',
      noManualPinLoginLoop: 'PASS',
      noFalseAgentDegradationFromAuth: 'PASS',
      previousAccessInvalidation: 'PASS',
      refreshCookieContract: 'PASS',
    },
    responseSummary: summarizeResponses(responses),
    observations,
    failures,
    verdict: rotationCycles > 1 && reloadCycles > 0 && reopenCycles > 0 ? 'PASS' : 'FAIL',
  };
  await writeFile(join(evidenceDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ verdict: report.verdict, evidenceDirectory, rotationCycles, reloadCycles, reopenCycles, durationMinutes: report.durationMinutes })}\n`);
  if (report.verdict !== 'PASS') process.exitCode = 2;
} catch (error) {
  failures.push({ observedAt: new Date().toISOString(), message: error instanceof Error ? error.message : String(error) });
  if (page && !page.isClosed()) await page.screenshot({ path: join(evidenceDirectory, 'failure.png'), fullPage: true }).catch(() => undefined);
  await writeFile(join(evidenceDirectory, 'failure.json'), `${JSON.stringify({ runId, startedAt: startedAt.toISOString(), failedAt: new Date().toISOString(), failures, observations, responseSummary: summarizeResponses(responses) }, null, 2)}\n`);
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  for (const server of servers) server.closeAllConnections?.();
  await Promise.all(servers.map((server) => new Promise((resolvePromise) => server.close(resolvePromise))));
  for (const managedProcess of processes.reverse()) managedProcess.stop();
  if (tlsMaterialDirectory) await rm(tlsMaterialDirectory, { recursive: true, force: true });
}

// Some Windows stream handles owned by terminated child processes close late.
// The report and all cleanup are complete at this point, so do not let them
// extend or invalidate the controlled runner window.
setTimeout(() => process.exit(process.exitCode ?? 0), 100);

function startProcess(name, command, args, extraEnvironment) {
  const stdout = createWriteStream(join(evidenceDirectory, `${name}.stdout.log`), { flags: 'a' });
  const stderr = createWriteStream(join(evidenceDirectory, `${name}.stderr.log`), { flags: 'a' });
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnvironment },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  child.on('exit', (code) => stdout.end(`\nPROCESS_EXIT=${code}\n`));
  return {
    pid: child.pid,
    stop() {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
      stdout.end();
      stderr.end();
    },
  };
}

async function assertPortsFree(ports) {
  for (const port of ports) {
    await new Promise((resolvePromise, rejectPromise) => {
      const probe = net.createServer();
      probe.once('error', () => rejectPromise(new Error(`Required local test port is already in use: ${port}`)));
      probe.listen(port, '127.0.0.1', () => probe.close(resolvePromise));
    });
  }
}

async function createTestCertificate() {
  tlsMaterialDirectory = await mkdtemp(join(tmpdir(), 'agm-turn-auth-tls-'));
  const keyPath = join(tlsMaterialDirectory, 'localhost-test.key.pem');
  const certificatePath = join(tlsMaterialDirectory, 'localhost-test.cert.pem');
  const openssl = process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'
    : 'openssl';
  const result = spawnSync(openssl, [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath, '-out', certificatePath, '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost',
  ], { cwd: root, windowsHide: true, stdio: 'ignore' });
  if (result.status !== 0) throw new Error(`TLS test certificate generation failed: ${result.status}`);
  return { key: await readFile(keyPath), cert: await readFile(certificatePath) };
}

function startHttpsProxy(listenPort, upstreamPort, tls) {
  const server = https.createServer(tls, (request, response) => {
    const upstream = http.request({
      hostname: '127.0.0.1',
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, host: `127.0.0.1:${upstreamPort}` },
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on('error', (error) => {
      response.writeHead(502, { 'content-type': 'text/plain' });
      response.end(`LOCAL_TLS_PROXY_FAILURE: ${error.message}`);
    });
    request.pipe(upstream);
  });
  return new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(listenPort, '127.0.0.1', () => resolvePromise(server));
  });
}

function bindResponseCapture(targetPage) {
  targetPage.on('response', (response) => {
    if (!/turn-admin|operations\/turn|security\/secrets|production-preflight/.test(response.url())) return;
    responses.push({ observedAt: new Date().toISOString(), method: response.request().method(), url: new URL(response.url()).pathname, status: response.status() });
  });
}

async function login(targetPage) {
  await targetPage.goto(`${webOrigin}/turn`, { waitUntil: 'domcontentloaded' });
  await targetPage.locator('#adminPin').waitFor({ state: 'visible' });
  await targetPage.locator('#adminPin').fill(pin);
  const unlockResponse = waitForSuccessfulResponse(targetPage, '/turn-admin/unlock');
  const dashboardResponse = waitForSuccessfulResponse(targetPage, '/operations/turn/operational-dashboard');
  await Promise.all([targetPage.locator('#adminLoginForm').evaluate((form) => form.requestSubmit()), unlockResponse, dashboardResponse]);
  await targetPage.locator('.turn-command-center').waitFor({ state: 'visible' });
  const legalAcceptance = targetPage.locator('#acceptLegalNotice');
  if (await legalAcceptance.isVisible().catch(() => false)) {
    await legalAcceptance.click();
    await targetPage.locator('.turn-command-center').waitFor({ state: 'visible' });
  }
  const tutorial = targetPage.locator('#skipTutorial');
  if (await tutorial.isVisible().catch(() => false)) await tutorial.click();
  const roadmap = targetPage.locator('#skipRoadmapInvitation');
  if (await roadmap.isVisible().catch(() => false)) await roadmap.click();
}

async function assertCookieContract(context) {
  const cookies = await context.cookies(`${apiOrigin}/api/v1/turn-admin/refresh`);
  const cookie = cookies.find((item) => item.name === 'agm_turn_refresh');
  assert(cookie, 'Refresh cookie missing');
  assert.equal(cookie.httpOnly, true, 'Refresh cookie is not HttpOnly');
  assert.equal(cookie.secure, true, 'Refresh cookie is not Secure');
  assert.equal(cookie.sameSite, 'None', 'Refresh cookie SameSite is not None');
  assert.equal(cookie.path, '/api/v1/turn-admin', 'Refresh cookie path is incorrect');
  assert.equal(cookie.domain, browserHost, 'Refresh cookie is not host-only for the test origin');
  return cookie;
}

async function assertTurnSurfaces(targetPage) {
  for (const target of ['basic', 'premium', 'incidents', 'investigate']) {
    await targetPage.locator(`[data-turn-page-target="${target}"]`).click();
    const visible = await targetPage.locator(`[data-turn-page="${target}"]`).first().isVisible();
    assert.equal(visible, true, `TURN ${target} surface is not accessible`);
  }
}

async function premiumFailureText(targetPage) {
  return targetPage.locator('[data-premium-operational-panel]').evaluate((root) => {
    const status = root.querySelector('[data-control-status]')?.textContent ?? '';
    const message = root.querySelector('[data-network-message]')?.textContent ?? '';
    const stage = root.querySelector('[data-premium-orbital-stage]')?.textContent ?? '';
    return `${status} ${message} ${stage}`;
  });
}

async function readAccessToken(targetPage) {
  const token = await targetPage.evaluate(() => {
    const raw = sessionStorage.getItem('agm.admin.session');
    const parsed = raw ? JSON.parse(raw) : null;
    return typeof parsed?.accessToken === 'string' ? parsed.accessToken : null;
  });
  assertBrowser(Boolean(token), 'Access token missing from ephemeral sessionStorage');
  return token;
}

async function readAccessFingerprint(targetPage) {
  return fingerprint(await readAccessToken(targetPage));
}

function waitForSuccessfulResponse(targetPage, path) {
  return targetPage.waitForResponse((response) => response.url().includes(path) && response.status() >= 200 && response.status() < 300, { timeout: 30_000 });
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Target did not become ready: ${url}; ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function summarizeResponses(items) {
  const summary = {};
  for (const item of items) {
    const key = `${item.method} ${item.url} ${item.status}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  return summary;
}

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex');
}

function elapsedMinutes() {
  return Number(((Date.now() - (turnOpenedAt?.getTime() ?? startedAt.getTime())) / 60_000).toFixed(2));
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function assertBrowser(condition, message) {
  if (!condition) throw new Error(message);
}

async function revision() {
  return new Promise((resolvePromise) => {
    const child = spawn('git', ['rev-parse', 'HEAD'], { cwd: root, windowsHide: true });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.on('exit', () => resolvePromise(output.trim() || 'UNKNOWN'));
  });
}
