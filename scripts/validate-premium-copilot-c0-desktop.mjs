import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const target = 'http://127.0.0.1:5174';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'premium-copilot', 'c0', 'desktop', runId);
const results = [];
const logs = [];
let server;
let browser;
let fatal;

const record = (event, detail = {}) => logs.push({ at: new Date().toISOString(), event, ...detail });
const healthy = async () => { try { return (await fetch(target)).status === 200; } catch { return false; } };
async function start() {
  if (await healthy()) return;
  server = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port 5174 --strictPort'], { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { if (await healthy()) return; await new Promise(r => setTimeout(r, 250)); }
  throw new Error('Cockpit 5174 unavailable');
}
async function scenario(page, id, action) {
  const startedAt = new Date().toISOString();
  try {
    const detail = await action();
    const screenshot = path.join(out, `${id}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ id, status: 'PASS', startedAt, finishedAt: new Date().toISOString(), url: page.url(), screenshot: path.relative(root, screenshot), detail });
  } catch (error) {
    results.push({ id, status: 'FAIL', startedAt, finishedAt: new Date().toISOString(), url: page.url(), detail: String(error) });
    throw error;
  }
}

await mkdir(out, { recursive: true });
try {
  await start();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('console', message => record('console', { type: message.type(), text: message.text() }));
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
  });
  await page.route('**/api/v1/**', async route => {
    const url = route.request().url();
    let data = {};
    if (url.endsWith('/auth/login')) data = { accessToken: 'controlled-test-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } };
    else if (url.endsWith('/auth/entitlements')) data = { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'c0-controlled-runner' }) });
  });
  const openPremium = async () => {
    await page.goto(`${target}/access`, { waitUntil: 'networkidle' });
    await page.locator('input[name=email]').fill('owner@example.test');
    await page.locator('input[name=password]').fill('not-a-real-secret');
    await page.locator('[data-access-login]').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
    await page.evaluate(() => { history.pushState({}, '', '/premium'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForSelector('[data-premium-copilot]');
  };
  await openPremium();

  await scenario(page, 'c0-single-surface', async () => {
    if (await page.locator('[data-premium-workspace]').count()) throw new Error('Legacy hub workspace exposed');
    for (const selector of ['[data-assistant-start]', '[data-copilot-camera]', '[data-copilot-text]', '[data-assistant-replay]']) if (!(await page.locator(selector).isVisible())) throw new Error(`Missing ${selector}`);
    return 'Single Android-first Copilot surface; microphone, OCR, text and speaker visible';
  });
  await scenario(page, 'c0-confirmed-intent-safety', async () => {
    await page.locator('[data-assistant-transcript]').fill('Mi s-a aprins martorul de frână.');
    await page.locator('[data-copilot-route]').click();
    const routed = await page.locator('[data-copilot-intent]').innerText();
    if (!routed.includes('DASHBOARD_WARNING') || !(await page.locator('[data-copilot-safety]').isVisible())) throw new Error('Safety intent was not routed');
    if (await page.locator('[data-assistant-confirm]').isVisible()) throw new Error('AI action exposed before safety confirmation');
    return 'Transcript remained editable until explicit confirmation; deterministic safety intent selected';
  });
  await scenario(page, 'c0-unsafe-refresh-recovery', async () => {
    await page.locator('[data-safe="false"]').click();
    if (!(await page.locator('[data-copilot-safe-stop]').isVisible())) throw new Error('Safe-stop instruction absent');
    await openPremium();
    const stopVisible = await page.locator('[data-copilot-safe-stop]').isVisible();
    const transcriptDisabled = await page.locator('[data-assistant-transcript]').isDisabled();
    if (!stopVisible || !transcriptDisabled) throw new Error(`Unsafe state not restored: stopVisible=${stopVisible}, transcriptDisabled=${transcriptDisabled}`);
    return 'Unsafe safety gate persisted through refresh; normal continuation remained blocked';
  });
  await scenario(page, 'c0-feature-flag-rollback', async () => {
    await page.evaluate(() => localStorage.setItem('agm.premium.single-copilot.enabled', 'false'));
    await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.evaluate(() => { history.pushState({}, '', '/premium'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForSelector('.premium-user-workspace');
    if (await page.locator('[data-premium-copilot]').count()) throw new Error('Copilot remained active after rollback');
    if (!(await page.locator('.premium-user-workspace').count())) throw new Error('Legacy projection not restored');
    return 'Nondestructive feature-flag rollback restored the prior Premium projection';
  });
} catch (error) { fatal = String(error); }
finally {
  await browser?.close();
  if (server) spawnSync('taskkill.exe', ['/pid', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const report = { schemaVersion: 1, runId, status: fatal ? 'FAIL' : 'PASS', runner: 'Controlled AGM Playwright/Chromium', buildContext: { revision }, target, iab: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE', results, fatal };
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(out, 'runner.log.jsonl'), logs.map(JSON.stringify).join('\n'));
  console.log(`PREMIUM COPILOT C0 DESKTOP: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (fatal) process.exitCode = 1;
}
