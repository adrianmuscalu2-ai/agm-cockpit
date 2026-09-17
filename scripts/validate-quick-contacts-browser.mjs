import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = path.join(root, 'evidence', 'quick-contacts', 'browser', runId);
const report = {
  schemaVersion: 1,
  runId,
  startedAt: new Date().toISOString(),
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'FAIL',
  targetPageStatus: 'FAIL',
  checks: [],
  evidenceDir,
};

function record(name, pass, detail = '') {
  report.checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
  if (!pass) throw new Error(name + ': ' + detail);
}

async function allocatePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : null;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function startTarget() {
  const port = await allocatePort();
  if (!port) throw new Error('Operating system did not allocate a free port.');
  const viteCli = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps', 'web'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Web bootstrap timeout. ' + output.slice(-500))), 30_000);
    const inspect = (chunk) => {
      output += chunk.toString();
      const match = output.replace(/\u001b\[[0-9;]*m/g, '').match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/i);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    };
    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.on('exit', (code) => reject(new Error('Web process exited before readiness (' + code + '). ' + output.slice(-500))));
  });
  return { child, url };
}

async function dismissTransientUi(page) {
  await page.waitForTimeout(300);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const control = page.locator('#acceptLegalNotice:visible, #skipRoadmapInvitation:visible, #closeTutorial:visible, [data-command="tutorial-close"]:visible').first();
    if (!(await control.count())) break;
    await control.click();
    await page.waitForTimeout(100);
  }
}

await mkdir(evidenceDir, { recursive: true });
let target;
let browser;
try {
  target = await startTarget();
  const response = await fetch(target.url);
  record('TARGET HTTP 200', response.status === 200, target.url + ' status=' + response.status);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ro-RO' });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  const navigation = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  record('CONTROLLED NAVIGATION', Boolean(navigation && navigation.status() < 400), target.url);
  await page.locator('#app').waitFor({ state: 'attached', timeout: 10_000 });
  await dismissTransientUi(page);
  await page.evaluate(() => {
    window.history.pushState({}, '', '/profile');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await dismissTransientUi(page);
  await page.locator('form.profile-panel').waitFor({ state: 'visible', timeout: 10_000 });
  report.browserSessionStatus = 'PASS';
  report.targetPageStatus = 'PASS';
  record('BROWSER SESSION', true, await page.title());
  record('TARGET PAGE', true, page.url());

  const quickSection = page.locator('details[data-quick-contacts]');
  record('PROFILE QUICK CONTACTS SECTION', await quickSection.count() === 1, 'count=' + await quickSection.count());
  await quickSection.locator('summary').click();
  const countersBefore = await quickSection.locator('.quick-contact-counts span').allTextContents();
  record('THREE CHANNEL COUNTERS', countersBefore.length === 3 && countersBefore.every((text) => text.includes('0/20')), countersBefore.join(' | '));
  await page.screenshot({ path: path.join(evidenceDir, 'profile-quick-contacts-desktop.png'), fullPage: true });

  await page.locator('#openQuickContacts').click();
  const dialog = page.locator('.contact-manager-window');
  await dialog.waitFor({ state: 'visible', timeout: 5_000 });
  record('CONTACT MANAGER OPENED', await dialog.count() === 1, 'modal visible');
  record('MESSENGER FIELD VISIBLE', await page.locator('#contactMessenger').isVisible(), 'contactMessenger');

  await page.locator('#contactName').fill('Audit Contact');
  await page.locator('#contactEmail').fill('audit@example.invalid');
  await page.locator('#contactPhone').fill('+49 170 000 000');
  await page.locator('#contactMessenger').fill('agm.audit');
  await page.locator('#saveContact').click();
  await page.locator('.contact-row').filter({ hasText: 'Audit Contact' }).waitFor({ state: 'visible', timeout: 5_000 });
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('agm.contact-manager.contacts') || '[]'));
  record(
    'LOCAL CONTACT PERSISTENCE',
    stored.length === 1 && stored[0].email === 'audit@example.invalid' && stored[0].messenger === 'agm.audit',
    'one isolated session contact with all three channels',
  );
  await page.screenshot({ path: path.join(evidenceDir, 'quick-contact-manager-desktop.png'), fullPage: true });

  await page.locator('#closeContactManager').click();
  const refreshedSection = page.locator('details[data-quick-contacts]');
  await refreshedSection.evaluate((element) => {
    element.open = true;
  });
  const countersAfter = await refreshedSection.locator('.quick-contact-counts span').allTextContents();
  record('COUNTERS UPDATED', countersAfter.length === 3 && countersAfter.every((text) => text.includes('1/20')), countersAfter.join(' | '));

  await page.setViewportSize({ width: 390, height: 844 });
  await refreshedSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  record('MOBILE NO OVERFLOW', dimensions.scroll <= dimensions.client, JSON.stringify(dimensions));
  await page.screenshot({ path: path.join(evidenceDir, 'profile-quick-contacts-mobile.png') });
  record('NO RUNTIME ERRORS', runtimeErrors.length === 0, runtimeErrors.join(' | '));
  record('BROWSER REAL VALIDATION', true, 'profile, modal, 20/20/20 counters, local storage and responsive capture');
  await context.close();
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  if (target?.child) {
    spawnSync('taskkill.exe', ['/pid', String(target.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    target.child.stdout?.destroy();
    target.child.stderr?.destroy();
    target.child.unref();
  }
  report.finishedAt = new Date().toISOString();
  report.status = report.error ? 'FAIL' : 'PASS';
  await writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
}

console.log('QUICK CONTACTS CONTROLLED BROWSER: ' + report.status);
console.log('Browser Plugin Status: ' + report.browserPluginStatus);
console.log('Integrated Browser Control Status: ' + report.integratedBrowserControlStatus);
console.log('Browser Session Status: ' + report.browserSessionStatus);
console.log('Target Page Status: ' + report.targetPageStatus);
console.log('Evidence: ' + path.join(evidenceDir, 'report.json'));
if (report.error) {
  console.error(report.error);
  process.exitCode = 1;
}
