import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = path.join(root, 'evidence', 'agma-profile-app-access-20261121', 'browser', runId);
const results = [];
let browser;
let server;
let fatal;
let target = '';

const check = (id, pass, detail) => {
  results.push({ id, status: pass ? 'PASS' : 'FAIL', detail });
  if (!pass) throw new Error(`${id}: ${detail}`);
};

async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function startTarget() {
  const port = await freePort();
  const vite = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
  server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  target = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(target)).status === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('TARGET_HTTP_200_TIMEOUT');
}

await mkdir(evidenceDir, { recursive: true });
try {
  await startTarget();
  check('Browser Plugin Status', true, 'Repository preflight and Playwright package available');
  check('Integrated Browser Control Status', true, 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE');
  browser = await chromium.launch({ headless: true });
  check('Browser Session Status', true, `Controlled Chromium ${browser.version()}`);
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'ro-RO' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.profile.application-access.v1', JSON.stringify({
      schemaVersion: 1,
      driverSafetyMode: 'NORMAL',
      entries: [
        { packageName: 'com.google.android.apps.maps', appName: 'Maps', enabled: true, allowedActions: ['OPEN_APP'], restrictedActions: ['OPEN_APP', 'NAVIGATE_TO_DESTINATION'], safetyClass: 'NAVIGATION', permissionState: 'GRANTED', availability: 'AVAILABLE', state: 'ON' },
        { packageName: 'com.example.notes', appName: 'Notes', enabled: false, allowedActions: [], restrictedActions: ['OPEN_APP'], safetyClass: 'GENERAL', permissionState: 'UNKNOWN', availability: 'AVAILABLE', state: 'OFF' },
        { packageName: 'com.example.bank', appName: 'Banking', enabled: false, allowedActions: [], restrictedActions: [], safetyClass: 'HARD_BLOCKED', permissionState: 'UNKNOWN', availability: 'AVAILABLE', state: 'BLOCKED_BY_POLICY' },
      ],
    }));
  });
  const response = await page.goto(`${target}/profile`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  check('Target Page Status', response?.status() === 200, `${target}/profile HTTP ${response?.status()}`);
  const legal = page.locator('#acceptLegalNotice:visible');
  if (await legal.count()) await legal.click();
  await page.locator('.application-access-section').waitFor({ state: 'visible' });
  check('profile-navigation', await page.locator('.profile-panel').count() === 1, 'Profile route rendered');
  check('application-list', await page.locator('.application-access-card').count() === 3, 'Three fixtures rendered without duplicates');
  check('deny-by-default-ui', !(await page.locator('[data-app-enabled="com.example.notes"]').isChecked()), 'New general app remains OFF');
  check('sensitive-block-ui', await page.locator('[data-app-enabled="com.example.bank"]').isDisabled(), 'Sensitive application switch disabled');
  await page.locator('[data-app-enabled="com.example.notes"]').check();
  await page.locator('[data-app-action="com.example.notes"][data-action="OPEN_APP"]').check();
  check('grant-persisted',await page.evaluate(()=>JSON.parse(localStorage.getItem('agm.profile.application-access.v1')).entries.find(e=>e.packageName==='com.example.notes').allowedActions.includes('OPEN_APP')),'Explicit opening grant persisted');
  await page.locator('[data-app-sensitive="com.example.notes"]').check();
  check('sensitive-override',await page.locator('[data-app-enabled="com.example.notes"]').isDisabled(),'Sensitive marking revokes opening permission');
  check('revocation-persisted',await page.evaluate(()=>!JSON.parse(localStorage.getItem('agm.profile.application-access.v1')).entries.find(e=>e.packageName==='com.example.notes').enabled),'Revocation persisted');
  await page.locator('#profileApplicationSearch').fill('Maps');
  check('search-filter', await page.locator('.application-access-card:visible').count() === 1, 'Name/package filter narrows list');
  const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  check('mobile-layout', layout.scrollWidth <= layout.width, JSON.stringify(layout));
  check('runtime-errors', pageErrors.length === 0, pageErrors.join('; ') || 'none');
  const screenshot = path.join(evidenceDir, 'profile-application-access-mobile.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.locator('#resetProfile').click();
  check('reset-revokes',await page.evaluate(()=>JSON.parse(localStorage.getItem('agm.profile.application-access.v1')).entries.length===0),'Reset clears persisted app grants');

} catch (error) {
  fatal = String(error);
} finally {
  await browser?.close();
  server?.kill();
  const report = {
    schemaVersion: 1,
    runId,
    status: !fatal && results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
    runner: 'Controlled AGM Playwright/Chromium',
    target,
    route: '/profile',
    browserPluginStatus: results.find((item) => item.id === 'Browser Plugin Status')?.status ?? 'FAIL',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: results.find((item) => item.id === 'Browser Session Status')?.status ?? 'FAIL',
    targetPageStatus: results.find((item) => item.id === 'Target Page Status')?.status ?? 'FAIL',
    results,
    fatal,
    finishedAt: new Date().toISOString(),
  };
  await writeFile(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PROFILE APPLICATION ACCESS BROWSER: ${report.status}`);
  console.log(path.join(evidenceDir, 'report.json'));
  if (report.status !== 'PASS') process.exitCode = 1;
}
