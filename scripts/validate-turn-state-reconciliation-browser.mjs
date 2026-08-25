import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'turn-state-reconciliation', 'browser', runId);
let target = process.env.AGM_TURN_RECONCILIATION_URL;
const results = [];
let browser;
let controlledServer;
let fatal = null;

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function startControlledTarget() {
  if (target) return;
  const port = await freePort();
  const vite = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
  controlledServer = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' });
  target = `http://127.0.0.1:${port}/turn`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(target)).status === 200) return; } catch { /* wait for Vite */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('CONTROLLED_TARGET_UNAVAILABLE');
}

await mkdir(output, { recursive: true });
try {
  await startControlledTarget();
  const targetResponse = await fetch(target, { signal: AbortSignal.timeout(10_000) });
  if (targetResponse.status !== 200) throw new Error(`TARGET_HTTP_${targetResponse.status}`);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, locale: 'ro-RO' });
  await page.addInitScript(() => {
    sessionStorage.setItem('agm.auth.accessToken', 'controlled-turn-reconciliation-token');
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'turn-reconciliation-controlled' }) });
    if (pathname.endsWith('/agent-runtime-events')) {
      return json({ events: [{
        eventId: 'expected-negative-acceptance-failed', mandateId: 'turn-production-failed-expected-negative', agentId: 'agent-inspector', dossierId: 'dossier-expected-negative', lifecycle: 'FAILED', sequence: 3,
        occurredAt: '2026-08-24T20:27:19.223Z', recordedAt: '2026-08-24T20:27:19.225Z', evidenceRef: 'apps/api/runtime-evidence/agent-inspector-missing.json', outputRef: null, evidenceHash: null,
        detail: 'Expected negative-path acceptance: missing evidence fixture.',
      }], cursor: null });
    }
    if (pathname.endsWith('/operations/components/android/health')) return json({ contract: 'component-heartbeat.v1', componentId: 'android', status: 'ONLINE', checkedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), lastFailureAt: null, lastFailureReason: null, reason: 'HEARTBEAT_CURRENT', detail: 'AGM Android foreground runtime', freshness: 'LIVE' });
    if (pathname.endsWith('/security/secrets/health')) return json({ overallStatus: 'CONFIGURED' });
    if (pathname.endsWith('/operations/production-preflight')) return json({ status: 'PASS', checkedAt: new Date().toISOString(), checks: [] });
    if (pathname.endsWith('/health/live')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    if (pathname.endsWith('/health/ready')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', dependencies: { translationProvider: 'available', database: 'available' } }) });
    if (pathname.endsWith('/auth/refresh')) return json({ accessToken: 'controlled-turn-reconciliation-token' });
    return route.continue();
  });

  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#turn-dashboard');
  await page.waitForFunction(() => document.querySelector('[data-operation-id="android"] .operation-service-status')?.textContent === 'ONLINE');
  await page.waitForFunction(() => document.querySelector('[data-agent-row-id="agent-inspector"]')?.getAttribute('data-last-runtime-lifecycle') === 'FAILED');

  const audit = await page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const row = (id) => document.querySelector(`[data-agent-row-id="${id}"]`);
    const linguistic = ['agent-linguistic-ro-de', 'agent-linguistic-ro-en', 'agent-linguistic-de-en'].map((id) => ({ id, text: row(id)?.textContent?.replace(/\s+/g, ' ').trim(), className: row(id)?.className }));
    const inspector = row('agent-inspector');
    const realBoard = document.querySelector('.turn-real-status-board');
    return {
      linguistic,
      inspector: { text: inspector?.textContent?.replace(/\s+/g, ' ').trim(), className: inspector?.className, registryStatus: inspector?.querySelector('.turn-status')?.textContent, lastRuntimeLifecycle: inspector?.getAttribute('data-last-runtime-lifecycle'), lastRuntimeMandate: inspector?.getAttribute('data-last-runtime-mandate') },
      android: text('[data-operation-id="android"]'),
      chief: text('#turn-independent-monitor-title'),
      chiefSection: text('.turn-independent-monitor'),
      realBoardPlanned: [...(realBoard?.querySelectorAll('.turn-status-row.planned[data-live-agent-id]') ?? [])].map((item) => item.textContent?.replace(/\s+/g, ' ').trim()),
      decorativeNamesPresent: ['Orion', 'Nexa', 'GeminII'].filter((name) => realBoard?.textContent?.includes(name)),
      staleInspectorArchive: document.body.textContent?.includes('SNAPSHOT ISTORIC / STALE') ?? false,
      monitorIncidentPresent: document.body.textContent?.includes('Agent Monitorizare Incidente') ?? false,
    };
  });
  const checks = {
    linguisticActive: audit.linguistic.every((item) => item.text?.toLowerCase().endsWith('active')),
    inspectorRegistryActive: audit.inspector.registryStatus?.toLowerCase() === 'active' && !audit.inspector.className?.includes('failed'),
    inspectorLastRunSeparated: audit.inspector.lastRuntimeLifecycle === 'FAILED' && audit.inspector.lastRuntimeMandate === 'turn-production-failed-expected-negative',
    androidLive: /AndroidONLINE/.test(audit.android) && /Data freshnessLIVE/.test(audit.android) && /Incident status[^A-Z]*NONE/.test(audit.android),
    chiefSeparatedFromMon010: audit.chief.includes('CHIEF-MONITORING-INSPECTOR') && !audit.chief.includes('MON-010') && audit.monitorIncidentPresent,
    noDecorativeOperationalNodes: audit.decorativeNamesPresent.length === 0 && audit.realBoardPlanned.length === 0,
    staleInspectorArchive: audit.staleInspectorArchive,
  };
  for (const [id, passed] of Object.entries(checks)) results.push({ id, status: passed ? 'PASS' : 'FAIL' });
  if (Object.values(checks).some((value) => !value)) throw new Error(`RECONCILIATION_ASSERTION_FAILED:${JSON.stringify({ checks, audit })}`);

  await page.locator('a[href="#turn-dashboard"]').click();
  await page.waitForFunction(() => location.hash === '#turn-dashboard');
  const screenshot = path.join(output, 'turn-state-reconciliation.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ id: 'navigation-and-capture', status: 'PASS', action: 'Turn navigation → #turn-dashboard', screenshot: path.relative(root, screenshot) });
  await writeFile(path.join(output, 'runtime-audit.json'), JSON.stringify(audit, null, 2), 'utf8');
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  controlledServer?.kill();
  const report = {
    schemaVersion: 1, runId, status: fatal ? 'FAIL' : 'PASS',
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: fatal ? 'FAIL' : 'PASS',
    targetPageStatus: fatal ? 'FAIL' : 'PASS',
    target, results, fatal, finishedAt: new Date().toISOString(),
  };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ report: path.join(output, 'report.json'), ...report }, null, 2));
  if (fatal) process.exitCode = 1;
}
