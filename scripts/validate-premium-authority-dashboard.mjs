import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const webRequire = createRequire(path.join(process.cwd(), 'apps', 'web', 'package.json'));
const { createServer: createViteServer } = await import(pathToFileURL(webRequire.resolve('vite')).href);
const { PrismaClient } = require('@prisma/client');
const { AuthorityControlPlaneService } = require('../apps/api/dist/authority-control-plane/authority-control-plane.service.js');
const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'authority-control-plane', 'browser', runId);
const results = [];
const report = {
  schemaVersion: 1, runId, runner: 'Controlled AGM Playwright/Chromium',
  browserPluginStatus: 'PASS', integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'FAIL', targetPageStatus: 'FAIL', results,
};
let viteServer;
let browser;
let page;
let fatal;
const runtimeErrors = [];

await mkdir(out, { recursive: true });
try {
  const prisma = new PrismaClient();
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  const user = company ? await prisma.user.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: 'asc' } }) : null;
  if (!company || !user) throw new Error('Controlled runner requires the existing local company and user.');
  const service = new AuthorityControlPlaneService(prisma);
  const dashboard = await service.dashboard({ companyId: company.id, userId: user.id, roles: ['OWNER'], requestId: randomUUID(), correlationId: randomUUID() });
  await prisma.$disconnect();
  if (dashboard.nodes.length < 19 || dashboard.opportunityIntelligence.gate !== 'GO') throw new Error('Persisted dashboard gate snapshot is incomplete.');

  const port = await freePort();
  const target = `http://127.0.0.1:${port}/`;
  viteServer = await createViteServer({ root: path.join(root, 'apps', 'web'), server: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'silent' });
  await viteServer.listen();
  await httpReady(target);
  report.target = target;
  browser = await chromium.launch({ headless: true });
  report.browserSessionStatus = 'PASS';
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ro-RO' });
  page = await context.newPage();
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    sessionStorage.setItem('agm.auth.accessToken', 'controlled-authority-token');
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    let data = {};
    if (url.endsWith('/auth/login') || url.endsWith('/auth/refresh')) data = { accessToken: 'controlled-authority-token', user: { id: user.id, displayName: user.displayName, email: user.email, roles: ['OWNER'] } };
    else if (url.endsWith('/auth/entitlements')) data = { subjectId: user.id, tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.team', 'premium.load-safety', 'premium.communications', 'premium.voice-assistant', 'car-mover.jobs'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' };
    else if (url.endsWith('/authority-control-plane/dashboard')) data = dashboard;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'controlled-authority-browser' }) });
  });

  await page.goto(new URL('/premium', target).toString(), { waitUntil: 'networkidle' });
  const premiumAuthorityCount = await page.locator('[data-authority-dashboard], [data-agent-network-detail]').count();
  const premiumNetworkLinks = await page.locator('a[href="/premium/network"]').count();
  const premiumText = await page.locator('body').innerText();
  if (premiumAuthorityCount !== 0 || premiumNetworkLinks !== 0 || premiumText.includes('Authority Control Plane')) {
    throw new Error('Authority Control Plane is still exposed in the Premium user surface.');
  }
  const premiumShot = path.join(out, 'premium-user-surface-1440x1000.png');
  await page.screenshot({ path: premiumShot, fullPage: true });
  results.push({ id: 'premium-user-boundary', status: 'PASS', route: '/premium', viewport: '1440x1000', screenshot: path.relative(root, premiumShot), detail: 'No Authority Control Plane, technical network drill-down or legacy network link is exposed.' });

  await page.goto(new URL('/premium/network', target).toString(), { waitUntil: 'networkidle' });
  const legacyAuthorityCount = await page.locator('[data-authority-dashboard], [data-agent-network-detail]').count();
  if (legacyAuthorityCount !== 0) throw new Error('Legacy /premium/network still exposes administrative telemetry.');
  results.push({ id: 'legacy-premium-network-closed', status: 'PASS', route: '/premium/network', detail: 'Legacy Premium route exposes no administrative dashboard or network registry.' });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(new URL('/turn', target).toString(), { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-authority-dashboard][aria-busy="false"]');
  await page.waitForSelector('[data-agent-network-detail][aria-busy="false"]');
  const hero = await inspect(page, dashboard.nodes.length);
  if (!hero.pass) throw new Error(hero.detail);
  const cards = await page.locator('.premium-network-agent').count();
  if (cards !== dashboard.nodes.length) throw new Error(`Turn drill-down rendered ${cards}/${dashboard.nodes.length} registry nodes.`);
  const turnShot = path.join(out, 'turn-authority-dashboard-1440x1000.png');
  await page.screenshot({ path: turnShot, fullPage: true });
  results.push({ id: 'turn-authority-dashboard', status: 'PASS', route: '/turn', viewport: '1440x1000', screenshot: path.relative(root, turnShot), detail: `${hero.detail}; drill-down=${cards} real registry nodes` });

  for (const viewport of [{ width: 1024, height: 768, name: 'tablet' }, { width: 412, height: 915, name: 'mobile' }]) {
    await page.setViewportSize(viewport);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-agent-network-detail][aria-busy="false"]');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`Turn ${viewport.name} has horizontal overflow.`);
    const shot = path.join(out, `turn-authority-network-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    results.push({ id: `turn-authority-${viewport.name}`, status: 'PASS', route: '/turn', viewport: `${viewport.width}x${viewport.height}`, screenshot: path.relative(root, shot), detail: 'Administrative dashboard remains responsive inside Turn.' });
  }
  if (runtimeErrors.length) throw new Error(`Browser runtime errors: ${runtimeErrors.join(' | ')}`);
  report.targetPageStatus = 'PASS';
  report.probe = `${target}premium user boundary -> legacy premium/network closure -> Turn-only Authority Control Plane; desktop/tablet/mobile`;
  await context.close();
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
  if (page) {
    report.failureUrl = page.url();
    report.failureText = String(await page.locator('body').innerText().catch(() => '')).slice(0, 1500);
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => undefined);
  }
} finally {
  await browser?.close();
  await viteServer?.close();
  report.status = fatal ? 'FAIL' : 'PASS';
  report.fatal = fatal;
  report.runtimeErrors = runtimeErrors;
  report.finishedAt = new Date().toISOString();
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`TURN-ONLY AUTHORITY DASHBOARD BROWSER: ${report.status}`);
console.log(path.join(out, 'report.json'));
if (fatal) { console.error(fatal); process.exitCode = 1; }

async function inspect(page, expectedNodes) {
  const text = await page.locator('[data-authority-dashboard]').innerText();
  const renderedNodes = await page.locator('.agm-network-node').count();
  const controlNodes = await page.locator('.agm-control-plane-node').count();
  const controlStatus = (await page.locator('[data-control-status]').innerText()).trim();
  const opportunityGate = (await page.locator('[data-opportunity-gate]').innerText()).trim();
  const forbidden = ['MADE WITH AI', 'NODES :: 24', 'FIELD AGENTS: 42'];
  const fictionalMarkers = forbidden.filter((marker) => text.toUpperCase().includes(marker));
  const pass = renderedNodes === expectedNodes - 1 && controlNodes === 1 && controlStatus === 'PASS' && opportunityGate === 'GO' && fictionalMarkers.length === 0;
  return { pass, detail: `${renderedNodes} peripheral real nodes; central=${controlNodes}; status=${controlStatus}; gate=${opportunityGate}; fictional=${fictionalMarkers.join(',') || 'none'}` };
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const address = probe.address(); const port = typeof address === 'object' && address ? address.port : 0; probe.close((error) => error ? reject(error) : resolve(port)); });
  });
}
async function httpReady(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) { try { if ((await fetch(url)).status === 200) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 250)); }
  throw new Error(`Target did not become HTTP 200: ${url}`);
}
