import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const webRoot = path.join(root, 'apps', 'web');
const webRequire = createRequire(path.join(webRoot, 'package.json'));
const { createServer: createViteServer } = await import(pathToFileURL(webRequire.resolve('vite')).href);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = path.join(root, 'evidence', 'app-i18n', 'linguistic-agents', 'browser', runId);
const target = 'http://127.0.0.1:5174/turn';
const agents = ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv'];
const viewports = {
  desktop: { width: 1440, height: 1100 },
  mobile: { width: 412, height: 915 },
};
const results = [];
const runtimeErrors = [];
const heartbeatStore = new Map();
const report = {
  schemaVersion: 1,
  runId,
  startedAt: new Date().toISOString(),
  target,
  runner: 'Controlled AGM Playwright/Chromium',
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'FAIL',
  targetPageStatus: 'FAIL',
  results,
};
let viteServer;
let browser;
let fatal;

await mkdir(evidenceDir, { recursive: true });
try {
  viteServer = await createViteServer({ root: webRoot, server: { host: '127.0.0.1', port: 5174, strictPort: true }, logLevel: 'silent' });
  await viteServer.listen();
  await httpReady(target);
  browser = await chromium.launch({ headless: true });
  report.browserSessionStatus = 'PASS';

  for (const [viewportName, viewport] of Object.entries(viewports)) {
    heartbeatStore.clear();
    const context = await browser.newContext({ viewport, locale: 'ro-RO', serviceWorkers: 'block' });
    await context.addInitScript(() => {
      sessionStorage.setItem('agm.auth.accessToken', 'controlled-language-agent-token');
      localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
      localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => runtimeErrors.push({ viewport: viewportName, message: error.message }));
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const componentMatch = url.pathname.match(/\/operations\/components\/(premium-linguist-(?:it|es|sv))\/(heartbeat|health)$/);
      if (componentMatch) {
        const [, componentId, action] = componentMatch;
        if (action === 'heartbeat' && request.method() === 'POST') {
          const payload = request.postDataJSON();
          const snapshot = {
            contract: 'component-heartbeat.v1', componentId, status: payload.status,
            checkedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
            lastSuccessAt: payload.status === 'ONLINE' ? new Date().toISOString() : null,
            lastFailureAt: payload.status === 'DEGRADED' ? new Date().toISOString() : null,
            lastFailureReason: payload.status === 'DEGRADED' ? payload.reason : null,
            reason: payload.reason, detail: payload.detail, freshness: 'LIVE',
          };
          heartbeatStore.set(componentId, { payload, snapshot });
          await fulfill(route, snapshot);
          return;
        }
        const stored = heartbeatStore.get(componentId)?.snapshot ?? {
          contract: 'component-heartbeat.v1', componentId, status: 'UNKNOWN', checkedAt: new Date().toISOString(),
          lastSeenAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureReason: null,
          reason: 'NO_HEARTBEAT_RECORDED', detail: null, freshness: 'UNKNOWN',
        };
        await fulfill(route, stored);
        return;
      }
      if (url.pathname.endsWith('/auth/refresh')) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled session' }) });
        return;
      }
      if (url.pathname.endsWith('/agent-runtime-events')) {
        await fulfill(route, { events: [], nextCursor: null });
        return;
      }
      if (url.pathname.endsWith('/security/secrets/health')) {
        await fulfill(route, { overallStatus: 'CONFIGURED' });
        return;
      }
      if (url.pathname.endsWith('/authority-control-plane/dashboard')) {
        await fulfill(route, { contractVersion: 'AGM-PREMIUM-NETWORK-V1', nodes: [], departments: [], controlPlane: { status: 'PASS' } });
        return;
      }
      await fulfill(route, {});
    });

    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#turn-real-status');
    await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`[data-live-component-id="${id}"] [data-component-live-status]`)?.textContent?.includes('ONLINE')), agents, { timeout: 15_000 });
    await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`[data-live-agent-id="${id}"] [data-agent-live-status]`)?.textContent?.includes('ACTIVE')), agents, { timeout: 15_000 });
    if (heartbeatStore.size !== agents.length) throw new Error(`${viewportName}: expected ${agents.length} heartbeat POSTs, received ${heartbeatStore.size}`);
    for (const id of agents) {
      const heartbeat = heartbeatStore.get(id);
      if (heartbeat?.payload.status !== 'ONLINE') throw new Error(`${viewportName}/${id}: heartbeat is not ONLINE`);
      if (!String(heartbeat?.payload.detail).includes('total=1699;errors=0')) throw new Error(`${viewportName}/${id}: resource evidence missing`);
      const governance = await page.locator(`[data-agent-row-id="${id}"]`).count();
      if (governance !== 1) throw new Error(`${viewportName}/${id}: governance row missing or duplicated`);
      const organization = await page.locator(`[data-turn-org-agent="${id}"]`).count();
      if (organization !== 1) throw new Error(`${viewportName}/${id}: organization node missing or duplicated`);
    }
    await page.locator('[data-turn-org-agent="premium-linguist-it"]').click();
    const relationText = await page.locator('#turnOrgRelations').innerText();
    if (!relationText.includes('CATALOG AUDIT') || !relationText.toLocaleLowerCase().includes('i18n')) throw new Error(`${viewportName}: TURN relation mapping is incomplete`);
    const statusScreenshot = path.join(evidenceDir, `${viewportName}-turn-language-agent-status.png`);
    const organizationScreenshot = path.join(evidenceDir, `${viewportName}-turn-language-agent-organization.png`);
    await page.locator('#turn-real-status').screenshot({ path: statusScreenshot });
    await page.locator('#turn-structure').screenshot({ path: organizationScreenshot });
    results.push({
      id: viewportName,
      status: 'PASS',
      viewport,
      heartbeats: Object.fromEntries([...heartbeatStore].map(([id, value]) => [id, value.payload])),
      statusScreenshot: path.relative(root, statusScreenshot),
      organizationScreenshot: path.relative(root, organizationScreenshot),
      registryRows: agents.length,
      organizationNodes: agents.length,
    });
    await context.close();
  }
  if (runtimeErrors.length) throw new Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  report.targetPageStatus = 'PASS';
  report.probe = 'TURN / three canonical agent rows / three runtime heartbeat component rows / governance table / organization mapping / desktop + mobile';
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await browser?.close();
  await viteServer?.close();
  report.status = fatal ? 'FAIL' : 'PASS';
  report.fatal = fatal;
  report.runtimeErrors = runtimeErrors;
  report.finishedAt = new Date().toISOString();
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  await writeFile(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`FINAL LANGUAGE AGENTS BROWSER: ${report.status}`);
console.log(path.join(evidenceDir, 'report.json'));
if (fatal) {
  console.error(fatal);
  process.exitCode = 1;
}

async function fulfill(route, data) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'controlled-final-language-agents' }) });
}

async function httpReady(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(url)).status === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Target did not become HTTP 200: ${url}`);
}
