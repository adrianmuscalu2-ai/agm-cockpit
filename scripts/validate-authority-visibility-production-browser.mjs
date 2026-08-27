import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const target = 'https://app.agmcockpit.com/';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'authority-control-plane', 'production-visibility', runId);
const results = [];
const report = {
  schemaVersion: 1,
  runId,
  runner: 'Controlled AGM Playwright/Chromium',
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'FAIL',
  targetPageStatus: 'FAIL',
  target,
  results,
};
let browser;
let page;
let fatal;

await mkdir(out, { recursive: true });
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ro-RO', serviceWorkers: 'block' });
  report.browserSessionStatus = 'PASS';
  page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });
  const now = new Date().toISOString();
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    let data = {};
    if (url.endsWith('/auth/login') || url.endsWith('/auth/refresh')) data = { accessToken: 'controlled-visibility-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['OWNER', 'PREMIUM_ACCESS'] } };
    else if (url.endsWith('/auth/entitlements')) data = { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant', 'car-mover.jobs'], evaluatedAt: now, policyVersion: 'access-entitlements@1.0.0' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'controlled-authority-visibility' }) });
  });

  await page.goto(new URL('/access', target).toString(), { waitUntil: 'networkidle' });
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('not-a-real-secret');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');

  await navigate(page, '/premium', '.premium-user-dashboard');
  const premium = {
    heading: (await page.locator('#premium-dashboard-title').textContent())?.trim(),
    workspaces: await page.locator('.premium-user-workspace').count(),
    authorityDashboards: await page.locator('[data-authority-dashboard]').count(),
    networkDetails: await page.locator('[data-agent-network-detail]').count(),
    legacyLinks: await page.locator('a[href="/premium/network"]').count(),
  };
  if (premium.heading !== 'Centru Premium' || premium.workspaces !== 4 || premium.authorityDashboards || premium.networkDetails || premium.legacyLinks) {
    throw new Error(`Premium boundary mismatch: ${JSON.stringify(premium)}`);
  }
  const premiumShot = path.join(out, 'production-premium-user-surface.png');
  await page.screenshot({ path: premiumShot, fullPage: true });
  results.push({ id: 'production-premium-user-boundary', status: 'PASS', route: '/premium', detail: premium, screenshot: path.relative(root, premiumShot) });

  await navigate(page, '/premium/network', 'main');
  const legacyCount = await page.locator('[data-authority-dashboard], [data-agent-network-detail]').count();
  if (legacyCount !== 0) throw new Error('Legacy /premium/network exposes administrative content.');
  results.push({ id: 'production-legacy-network-closed', status: 'PASS', route: '/premium/network', detail: 'No administrative dashboard is rendered.' });

  await navigate(page, '/turn', '#adminLoginForm');
  const turn = {
    pinProtected: await page.locator('#adminLoginForm').count() === 1,
    authorityVisibleBeforeUnlock: await page.locator('#turn-authority-control-plane').count() > 0,
  };
  if (!turn.pinProtected || turn.authorityVisibleBeforeUnlock) throw new Error(`Turn protection mismatch: ${JSON.stringify(turn)}`);
  const turnShot = path.join(out, 'production-turn-pin-boundary.png');
  await page.screenshot({ path: turnShot, fullPage: true });
  results.push({ id: 'production-turn-protected-boundary', status: 'PASS', route: '/turn', detail: turn, screenshot: path.relative(root, turnShot) });

  if (runtimeErrors.length) throw new Error(`Browser runtime errors: ${runtimeErrors.join(' | ')}`);
  report.targetPageStatus = 'PASS';
  report.status = 'PASS';
  await context.close();
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
  report.status = 'FAIL';
  if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => undefined);
} finally {
  await browser?.close();
  report.fatal = fatal;
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`PRODUCTION AUTHORITY VISIBILITY: ${report.status}`);
console.log(path.join(out, 'report.json'));
if (fatal) { console.error(fatal); process.exitCode = 1; }

async function navigate(activePage, route, selector) {
  await activePage.evaluate((value) => { history.pushState({}, '', value); dispatchEvent(new PopStateEvent('popstate')); }, route);
  await activePage.waitForURL((url) => url.pathname === route);
  await activePage.waitForSelector(selector);
}
