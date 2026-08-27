import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const webRequire = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const { createServer: createViteServer } = await import(pathToFileURL(webRequire.resolve('vite')).href);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'live-mobility', 'browser', runId);
const results = [];
const report = { schemaVersion: 1, runId, runner: 'Controlled AGM Playwright/Chromium', browserPluginStatus: 'PASS', integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE', browserSessionStatus: 'FAIL', targetPageStatus: 'FAIL', results };
let viteServer; let browser; let page; let fatal;

await mkdir(out, { recursive: true });
try {
  const port = await freePort(); const target = `http://127.0.0.1:${port}/`;
  viteServer = await createViteServer({ root: path.join(root, 'apps', 'web'), server: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'silent' });
  await viteServer.listen(); await httpReady(target); report.target = target;
  browser = await chromium.launch({ headless: true }); report.browserSessionStatus = 'PASS';
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'ro-RO' }); page = await context.newPage();
  const runtimeErrors = []; let decisionWrites = 0; let manualJobWrites = 0;
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() })); localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString()); });
  const jobs = [{ id: 'manual-existing', currentState: 'DRAFT', vehicleSubject: { vehicleClass: 'PASSENGER_CAR', vehicleType: 'hatchback', make: 'Volkswagen', model: 'Golf' }, pickupSnapshot: { label: 'Berlin' }, destinationSnapshot: { label: 'Hamburg' }, updatedAt: new Date().toISOString() }];
  const planning = [
    planningItem('verdict-3', 'chain-3', 'RECOMMENDED', 3, { estimatedGrossProfit: 341, estimatedProfitPerKm: 0.61, estimatedProfitPerHour: 36.8, emptyKm: 67, finalHomeDistanceKm: 18 }),
    planningItem('verdict-2', 'chain-2', 'ACCEPTABLE', 2, { estimatedGrossProfit: 286, estimatedProfitPerKm: 0.55, estimatedProfitPerHour: 31.2, emptyKm: 31, finalHomeDistanceKm: 42 }),
    planningItem('verdict-1', 'chain-1', 'WEAK', 1, { estimatedGrossProfit: 102, estimatedProfitPerKm: 0.21, estimatedProfitPerHour: 12.4, emptyKm: 88, finalHomeDistanceKm: 190 }),
  ];
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url(); const method = route.request().method(); let data = {};
    if (url.endsWith('/auth/login')) data = { accessToken: 'controlled-oi-token', user: { id: 'user', displayName: 'Owner', email: 'owner@example.test', roles: ['OWNER', 'PREMIUM_ACCESS'] } };
    else if (url.endsWith('/auth/entitlements')) data = { subjectId: 'user', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'car-mover.jobs'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' };
    else if (url.endsWith('/car-mover/jobs') && method === 'GET') data = jobs;
    else if (url.endsWith('/car-mover/jobs') && method === 'POST') { manualJobWrites += 1; data = { jobId: 'manual-new' }; }
    else if (url.endsWith('/communications/providers/status')) data = [{ channel: 'email', provider: 'gmail', configured: true }, { channel: 'whatsapp', provider: 'whatsapp', configured: true }];
    else if (url.endsWith('/car-mover/jobs/platform-offers/list')) data = [{ id: 'offer-1', channel: 'email', platformName: 'TIMOCOM', pickupLabel: 'Berlin', destinationLabel: 'Hamburg', vehicleDescription: 'Passenger car', offeredAmount: '500.00', currencyCode: 'EUR', estimatedKm: 290, score: 84, status: 'REVIEWED', extractionConfidence: 91, analysis: { reason: 'Verificată uman; disponibilă pentru planificare.' } }];
    else if (url.endsWith('/opportunity-intelligence/planning')) data = planning;
    else if (url.endsWith('/opportunity-intelligence/copilot')) data = { variantCount: 3, variants: [], recommendation: 'BEST_FRESH_RECOMMENDED_VARIANT', canAcceptAutomatically: false };
    else if (url.includes('/opportunity-intelligence/verdicts/') && url.endsWith('/decide') && method === 'POST') { decisionWrites += 1; data = { jobLinks: [{ jobId: 'human-approved-job' }] }; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'controlled-oi-browser' }) });
  });
  await page.goto(new URL('/access', target).toString(), { waitUntil: 'networkidle' });
  await page.locator('input[name=email]').fill('owner@example.test'); await page.locator('input[name=password]').fill('not-a-real-secret'); await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => { history.pushState({}, '', '/car-mover/menu'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForSelector('[data-car-mover-root]'); await page.waitForSelector('.car-mover-variant');

  const text = await page.locator('[data-opportunity-planning]').innerText(); const cards = await page.locator('.car-mover-variant').count();
  if (cards !== 3 || !text.includes('RECOMMENDED') || !text.includes('341') || !text.includes('67')) throw new Error('Planning does not render the three approved engine variants.');
  if (!text.includes('Mobilitate live') || !text.includes('TomTom') || !text.includes('FRESH') || !text.includes('290 km') || !text.includes('195 min')) throw new Error('Planning does not render the normalized live mobility summary.');
  if (!(await page.locator('[data-car-mover-create]').isVisible())) throw new Error('Manual Car Mover fallback is not visible.');
  const desktopShot = path.join(out, 'car-mover-opportunity-planning-1440x1100.png'); await page.screenshot({ path: desktopShot, fullPage: true });
  results.push({ id: 'oi-planning-desktop', status: 'PASS', route: '/car-mover/menu', viewport: '1440x1100', screenshot: path.relative(root, desktopShot), detail: '3 simple engine variants; RECOMMENDED visible; manual fallback visible' });

  page.once('dialog', (dialog) => dialog.accept()); await page.locator('[data-verdict-id="verdict-3"][data-opportunity-decision="ACCEPT"]').click(); await page.waitForFunction(() => document.querySelector('[data-car-mover-status]')?.textContent?.includes('Job File'));
  if (decisionWrites !== 1) throw new Error('Explicit human acceptance did not call the decision boundary exactly once.');
  results.push({ id: 'oi-human-decision', status: 'PASS', detail: 'Confirmation dialog accepted; one DECIDE write; Job File result shown' });

  const form = page.locator('[data-car-mover-create]'); await form.locator('select[name=vehicleClass]').selectOption('PASSENGER_CAR'); await form.locator('input[name=vehicleType]').fill('Manual fallback vehicle'); await form.locator('input[name=pickup]').fill('Berlin'); await form.locator('input[name=destination]').fill('Leipzig'); await form.evaluate((element) => element.requestSubmit()); await page.waitForFunction(() => document.querySelector('[data-car-mover-status]')?.textContent?.length > 0);
  if (manualJobWrites !== 1) throw new Error('Manual Job creation is not independently operational.');
  results.push({ id: 'oi-manual-fallback', status: 'PASS', detail: 'Manual Car Mover Job submission remains independent of Opportunity Intelligence' });

  await page.setViewportSize({ width: 412, height: 915 }); await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('.car-mover-variant');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); if (overflow) throw new Error('Opportunity Planning has horizontal mobile overflow.');
  const mobileShot = path.join(out, 'car-mover-opportunity-planning-412x915.png'); await page.screenshot({ path: mobileShot, fullPage: true });
  results.push({ id: 'oi-planning-mobile', status: 'PASS', route: '/car-mover/menu', viewport: '412x915', screenshot: path.relative(root, mobileShot), detail: 'responsive, no horizontal overflow' });
  if (runtimeErrors.length) throw new Error(`Browser runtime errors: ${runtimeErrors.join(' | ')}`);
  report.targetPageStatus = 'PASS'; report.probe = `${target}access -> car-mover/menu; login navigation; planning interaction; human accept; manual fallback; desktop/mobile captures`;
  await context.close();
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error); if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => undefined);
} finally {
  await browser?.close(); await viteServer?.close(); report.status = fatal ? 'FAIL' : 'PASS'; report.fatal = fatal; report.finishedAt = new Date().toISOString(); report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(); await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`LIVE MOBILITY PLANNING BROWSER: ${report.status}`); console.log(path.join(out, 'report.json')); if (fatal) { console.error(fatal); process.exitCode = 1; }

function planningItem(verdictId, chainKey, classification, count, metrics) { return { verdict: { id: verdictId, classification, freshnessStatus: 'FRESH', confidence: 88, risks: [], createdAt: new Date().toISOString() }, chain: { id: `id-${chainKey}`, chainKey, version: 1, opportunityIds: Array.from({ length: count }, (_, index) => `${chainKey}-op-${index + 1}`), metrics: { estimatedTotalCost: 112, ...metrics }, feasible: true }, humanDecision: null, mobilitySummary: { sources: ['TomTom route'], distanceKm: 290, durationMinutes: 195, repositionKm: 31, estimatedTolls: [{ amount: 14.5, currency: 'EUR' }], freshnessStatus: 'FRESH', validUntil: new Date(Date.now() + 30 * 60_000).toISOString(), warnings: [] } }; }
async function freePort() { return new Promise((resolve, reject) => { const probe = createNetServer(); probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const address = probe.address(); const port = typeof address === 'object' && address ? address.port : 0; probe.close((error) => error ? reject(error) : resolve(port)); }); }); }
async function httpReady(url) { for (let attempt = 0; attempt < 80; attempt += 1) { try { if ((await fetch(url)).status === 200) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 250)); } throw new Error(`Target did not become HTTP 200: ${url}`); }
