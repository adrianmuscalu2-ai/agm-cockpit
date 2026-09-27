import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const port = Number(process.env.AGM_OWNER_EXPIRY_WEB_PORT ?? '5192');
const origin = `http://127.0.0.1:${port}`;
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'turn-owner-session-expiry', 'browser', runId);
const results = [];
const pageErrors = [];
let browser;
let server;
let fatal = null;

await mkdir(output, { recursive: true });

try {
  await assertPortFree(port);
  server = spawn(process.execPath, [path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps', 'web'),
    windowsHide: true,
    stdio: 'ignore',
    env: { ...process.env, VITE_AGM_API_BASE_URL: 'http://127.0.0.1:39999/api/v1' },
  });
  await waitForHttp(`${origin}/turn`, 30_000);
  browser = await chromium.launch({ headless: true });

  for (const scenario of ['load', 'reload', 'reopen']) {
    const context = await browser.newContext({ viewport: { width: scenario === 'reload' ? 412 : 1440, height: scenario === 'reload' ? 915 : 1000 }, locale: 'ro-RO' });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push({ scenario, message: error.message }));
    await page.route('**/api/v1/turn-admin/refresh', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Sesiunea administrativă de reînnoire a expirat.' }) }));
    await page.addInitScript(() => {
      sessionStorage.setItem('agm.admin.session', JSON.stringify({ accessToken: 'synthetic-expired-owner-access', expiresInSeconds: 900 }));
      localStorage.setItem('agm.admin.session', JSON.stringify({ accessToken: 'legacy-token-must-be-purged', expiresInSeconds: 900 }));
      localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
      localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    });
    await page.goto(`${origin}/turn`, { waitUntil: 'domcontentloaded' });
    await page.locator('.admin-session-failure[role="alert"]').waitFor({ state: 'visible' });
    const state = await page.evaluate(() => ({
      alert: document.querySelector('.admin-session-failure[role="alert"]')?.textContent ?? '',
      ownerLogin: Boolean(document.querySelector('#adminLoginForm #adminPin')),
      dashboard: Boolean(document.querySelector('.turn-command-center')),
      sessionToken: sessionStorage.getItem('agm.admin.session'),
      persistentToken: localStorage.getItem('agm.admin.session'),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    assert.match(state.alert, /Sesiunea administrativă a expirat sau a fost revocată/);
    assert.match(state.alert, /Autentifică-te din nou prin Owner Access/);
    assert.equal(state.ownerLogin, true);
    assert.equal(state.dashboard, false);
    assert.equal(state.sessionToken, null);
    assert.equal(state.persistentToken, null);
    assert.equal(state.overflow, false);
    const screenshot = path.join(output, `owner-session-expired-${scenario}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ scenario, status: 'PASS', state, screenshot: path.relative(root, screenshot) });
    await context.close();
  }
  assert.equal(pageErrors.length, 0, `Relevant page errors: ${JSON.stringify(pageErrors)}`);
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await browser?.close().catch(() => undefined);
  if (server?.pid) server.kill();
  const report = {
    contract: 'agm-turn-owner-session-expiry-browser.v2',
    runId,
    status: fatal ? 'FAIL' : 'PASS',
    runner: 'Controlled AGM Playwright/Chromium',
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: fatal ? 'FAIL' : 'PASS',
    targetPageStatus: fatal ? 'FAIL' : 'PASS',
    target: `${origin}/turn`,
    authAuthority: 'Current HttpOnly refresh-family authority; deterministic 401 terminal response injected at network boundary',
    applicationMutation: 'NONE',
    results,
    pageErrors,
    fatal,
    finishedAt: new Date().toISOString(),
  };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`TURN OWNER SESSION EXPIRY BROWSER: ${report.status}`);
  console.log(path.join(output, 'report.json'));
  if (fatal) process.exitCode = 1;
}

function assertPortFree(candidate) {
  return new Promise((resolvePromise, rejectPromise) => {
    const probe = net.createServer();
    probe.once('error', () => rejectPromise(new Error(`PORT_IN_USE:${candidate}`)));
    probe.listen(candidate, '127.0.0.1', () => probe.close(resolvePromise));
  });
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).status === 200) return; } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`TARGET_UNAVAILABLE:${url}`);
}
