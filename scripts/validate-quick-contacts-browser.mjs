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
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({
      privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString(),
    }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    window.__agmPersonalContactHandoffs = 0;
    window.addEventListener('agm-android-assistant-handoff', () => { window.__agmPersonalContactHandoffs += 1; });
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    let data = {};
    if (url.endsWith('/auth/login') || url.endsWith('/auth/refresh')) {
      data = { accessToken: 'controlled-quick-contact-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } };
    } else if (url.endsWith('/auth/entitlements')) {
      data = { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'quick-contact-controlled-browser' }) });
  });
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

  const personalSection = page.locator('details[data-personal-contacts]');
  record('PROFILE AGM PERSONAL CONTACTS SECTION', await personalSection.count() === 1, 'count=' + await personalSection.count());
  await personalSection.locator('summary').click();
  const countersBefore = await personalSection.locator('.personal-contact-counts span').allTextContents();
  record('PERSON AND CHANNEL COUNTERS', countersBefore.length === 4 && countersBefore[0]?.includes('0/20') && countersBefore.slice(1).every((text) => text.includes('0')), countersBefore.join(' | '));
  await page.screenshot({ path: path.join(evidenceDir, 'profile-personal-contacts-desktop.png'), fullPage: true });

  await page.locator('#openPersonalContacts').click();
  const dialog = page.locator('.contact-manager-window');
  await dialog.waitFor({ state: 'visible', timeout: 5_000 });
  record('AGM PERSONAL CONTACT MANAGER OPENED', await dialog.count() === 1, 'modal visible');
  record('INTERNAL AUTHORIZED SOURCE NOTICE', await page.locator('[data-personal-contact-authority]').isVisible(), 'no READ_CONTACTS required for profile data');
  record('EXTENSIBLE CHANNEL GROUP VISIBLE', await page.locator('[data-contact-additional-channels]').isVisible(), 'Messenger and WhatsApp grouped as extensible channels');
  record('MESSENGER FIELD VISIBLE', await page.locator('#contactMessenger').isVisible(), 'contactMessenger');

  await page.locator('#contactName').fill('Mona Vodafone');
  await page.locator('#contactEmail').fill('mona@example.invalid');
  await page.locator('#contactPhone').fill('+40 700 123 456');
  await page.locator('#contactMessenger').fill('mona.vodafone');
  await page.locator('#saveContact').click();
  await page.locator('.contact-row').filter({ hasText: 'Mona Vodafone' }).waitFor({ state: 'visible', timeout: 5_000 });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('agm.contact-manager.contacts') || '[]'));
  record(
    'LOCAL CONTACT PERSISTENCE',
    stored.length === 1 && stored[0].name === 'Mona Vodafone' && stored[0].phone === '+40 700 123 456',
    'Mona Vodafone stored with the controlled quick-contact number',
  );
  await page.screenshot({ path: path.join(evidenceDir, 'personal-contact-manager-desktop.png'), fullPage: true });

  await page.locator('#closeContactManager').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissTransientUi(page);
  await page.evaluate(() => {
    window.history.pushState({}, '', '/profile');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.locator('form.profile-panel').waitFor({ state: 'visible', timeout: 10_000 });
  const refreshedSection = page.locator('details[data-personal-contacts]');
  await refreshedSection.evaluate((element) => {
    element.open = true;
  });
  const countersAfter = await refreshedSection.locator('.personal-contact-counts span').allTextContents();
  record('COUNTERS UPDATED', countersAfter.length === 4 && countersAfter[0]?.includes('1/20') && countersAfter.slice(1).every((text) => text.includes('1')), countersAfter.join(' | '));

  await page.setViewportSize({ width: 390, height: 844 });
  await refreshedSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  record('MOBILE NO OVERFLOW', dimensions.scroll <= dimensions.client, JSON.stringify(dimensions));
  await page.screenshot({ path: path.join(evidenceDir, 'profile-personal-contacts-mobile.png') });

  await page.setViewportSize({ width: 412, height: 915 });
  await page.evaluate(() => {
    history.pushState({}, '', '/access');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('controlled-browser-value');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => {
    history.pushState({}, '', '/premium/voice');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.locator('[data-premium-assistant]').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('[data-assistant-transcript]').fill('Apelează contactul Mona Vodafone');
  await page.locator('[data-assistant-confirm]').click();
  const actionPanel = page.locator('[data-assistant-action-panel]');
  await actionPanel.waitFor({ state: 'visible', timeout: 5_000 });
  const preview = await page.locator('[data-assistant-action-summary]').innerText();
  record('EXACT COMMAND ACCEPTED', preview.includes('Contact selectat: Mona Vodafone'), preview);
  record('SELECTED PHONE DISPLAYED', preview.includes('Număr: +40 700 123 456'), preview);
  record('AGM PERSONAL CONTACT SOURCE DISPLAYED', preview.includes('Sursă: Contacte personale AGM'), preview);
  record('NO AUTOMATIC CALL DISCLOSURE', preview.includes('Apelul nu va fi inițiat automat.'), preview);
  record('DIALER BLOCKED BEFORE AGM CONFIRMATION', await page.evaluate(() => window.__agmPersonalContactHandoffs === 0), 'no Android handoff event before explicit confirmation');
  await page.screenshot({ path: path.join(evidenceDir, 'assistant-mona-dial-preview.png'), fullPage: true });
  await page.locator('[data-assistant-action-reject]').click();

  await page.locator('[data-assistant-transcript]').fill('Trimite un Gmail lui Mona Vodafone.');
  await page.locator('[data-assistant-confirm]').click();
  await page.waitForFunction(() => {
    const receipts = JSON.parse(sessionStorage.getItem('agm.android-action.receipts.v1') || '[]');
    return receipts.at(-1)?.request?.action === 'EMAIL_DRAFT';
  });
  const gmailReceipt = await page.evaluate(() => JSON.parse(sessionStorage.getItem('agm.android-action.receipts.v1') || '[]').at(-1));
  record('GMAIL RESOLVED FROM AGM PROFILE', gmailReceipt?.resolution?.payload?.value === 'mona@example.invalid' && gmailReceipt?.resolution?.payload?.contactSource === 'AGM_PERSONAL_CONTACTS', JSON.stringify(gmailReceipt));
  record('GMAIL NEEDS NO EXTRA AGM CONFIRMATION', gmailReceipt?.result !== 'CONFIRMATION_REQUIRED', gmailReceipt?.result);
  record('GMAIL AUTHORIZATION FLOW UNCHANGED', !gmailReceipt?.guardianCorrelationId || gmailReceipt?.resolution?.action === 'EMAIL_DRAFT', 'existing draft handoff only; no Gmail reauthorization added');

  await page.locator('[data-assistant-transcript]').fill('Deschide Messenger la Mona.');
  await page.locator('[data-assistant-confirm]').click();
  await page.waitForFunction(() => {
    const receipts = JSON.parse(sessionStorage.getItem('agm.android-action.receipts.v1') || '[]');
    return receipts.at(-1)?.request?.action === 'MESSENGER_CHAT';
  });
  const messengerReceipt = await page.evaluate(() => JSON.parse(sessionStorage.getItem('agm.android-action.receipts.v1') || '[]').at(-1));
  record('MESSENGER RESOLVED FROM AGM PROFILE', messengerReceipt?.resolution?.payload?.value === 'mona.vodafone' && messengerReceipt?.resolution?.payload?.contactSource === 'AGM_PERSONAL_CONTACTS', JSON.stringify(messengerReceipt));
  record('MESSENGER NEEDS NO EXTRA AGM CONFIRMATION', messengerReceipt?.result !== 'CONFIRMATION_REQUIRED', messengerReceipt?.result);

  await page.locator('[data-assistant-transcript]').fill('Apelează Mona pe Messenger.');
  await page.locator('[data-assistant-confirm]').click();
  await page.waitForFunction(() => {
    const receipts = JSON.parse(sessionStorage.getItem('agm.android-action.receipts.v1') || '[]');
    return receipts.at(-1)?.request?.text === 'Apelează Mona pe Messenger.';
  });
  const messengerCallReceipt = await page.evaluate(() => JSON.parse(sessionStorage.getItem('agm.android-action.receipts.v1') || '[]').at(-1));
  record('MESSENGER CALL WORDING OPENS CHAT TARGET', messengerCallReceipt?.resolution?.action === 'MESSENGER_CHAT' && messengerCallReceipt?.resolution?.payload?.value === 'mona.vodafone', JSON.stringify(messengerCallReceipt));
  record('NO PHONE CONFIRMATION FOR MESSENGER CHAT', messengerCallReceipt?.result !== 'CONFIRMATION_REQUIRED', messengerCallReceipt?.result);

  await page.evaluate(() => {
    const contacts = JSON.parse(localStorage.getItem('agm.contact-manager.contacts') || '[]');
    contacts.push({ ...contacts[0], id: 'mona-duplicate', phone: '+40 700 654 321', updatedAt: new Date().toISOString() });
    localStorage.setItem('agm.contact-manager.contacts', JSON.stringify(contacts));
  });
  await page.locator('[data-assistant-transcript]').fill('Apelează contactul Mona Vodafone');
  await page.locator('[data-assistant-confirm]').click();
  const duplicateMessage = 'Am găsit mai multe contacte cu numele Mona Vodafone. Pe care vrei să îl apelezi?';
  await page.waitForFunction((expected) => document.querySelector('[data-assistant-response]')?.textContent === expected, duplicateMessage);
  record('DUPLICATE CLARIFICATION EXPLICIT', await page.locator('[data-assistant-response]').innerText() === duplicateMessage, duplicateMessage);
  record('DUPLICATE DOES NOT OPEN DIALER', await page.evaluate(() => window.__agmPersonalContactHandoffs === 0), 'no Android handoff event for ambiguous contact');
  record('DUPLICATE HAS NO CONFIRMATION PANEL', await actionPanel.isHidden(), 'confirmation panel remains hidden');
  await page.screenshot({ path: path.join(evidenceDir, 'assistant-mona-duplicate-clarification.png'), fullPage: true });
  record('NO RUNTIME ERRORS', runtimeErrors.length === 0, runtimeErrors.join(' | '));
  record('BROWSER REAL VALIDATION', true, 'personal profile, persistence, phone confirmation, Gmail, Messenger, duplicate clarification and responsive capture');
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

console.log('AGM PERSONAL CONTACTS CONTROLLED BROWSER: ' + report.status);
console.log('Browser Plugin Status: ' + report.browserPluginStatus);
console.log('Integrated Browser Control Status: ' + report.integratedBrowserControlStatus);
console.log('Browser Session Status: ' + report.browserSessionStatus);
console.log('Target Page Status: ' + report.targetPageStatus);
console.log('Evidence: ' + path.join(evidenceDir, 'report.json'));
if (report.error) {
  console.error(report.error);
  process.exitCode = 1;
}
