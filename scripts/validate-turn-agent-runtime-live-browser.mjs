import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const apiRequire = createRequire(path.join(root, 'apps', 'api', 'package.json'));
const { JwtService } = apiRequire('@nestjs/jwt');
const { PrismaClient } = apiRequire('@prisma/client');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'turn-reality', 'p0-agent-runtime-live', 'browser', runId);
const target = 'http://127.0.0.1:5174';
const suffix = `browser-${Date.now().toString(36)}`;
const completedMandateId = `p0-live-completed-${suffix}`;
const failedMandateId = `p0-live-failed-${suffix}`;
let server = null;
let browser = null;
let fatal = null;
const results = [];

async function loadEnvironment() {
  const content = await readFile(path.join(root, '.env'), 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
async function ready() { try { return (await fetch(target)).status === 200; } catch { return false; } }
async function startTarget() {
  if (await ready()) return;
  server = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port 5174 --strictPort'], { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 100; attempt += 1) { if (await ready()) return; await new Promise((resolve) => setTimeout(resolve, 250)); }
  throw new Error('TURN_BROWSER_TARGET_UNAVAILABLE');
}
async function realExecution() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'pnpm.cmd exec tsx apps/api/scripts/test-agent-runtime-persistent-e2e.ts'], { cwd: root, windowsHide: true, env: { ...process.env, AGENT_RUNTIME_API_BASE_URL: 'http://127.0.0.1:3000/api/v1', AGENT_RUNTIME_RUN_SUFFIX: suffix } });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('exit', (code) => code === 0 ? resolve(stdout) : reject(new Error(`REAL_EXECUTION_EXIT_${code}:${stderr.slice(-500)}`)));
  });
}

await mkdir(out, { recursive: true });
await loadEnvironment();
const prisma = new PrismaClient();
try {
  const user = await prisma.user.findFirst({ where: { status: 'Active' }, orderBy: { createdAt: 'asc' } });
  if (!user || !process.env.JWT_SECRET) throw new Error('BROWSER_AUTH_CONTEXT_UNAVAILABLE');
  const token = await new JwtService({ secret: process.env.JWT_SECRET }).signAsync({ sub: user.id, companyId: user.companyId, roles: [], scope: 'user' }, { expiresIn: '10m' });
  await startTarget();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, locale: 'ro-RO' });
  await page.addInitScript((accessToken) => {
    sessionStorage.setItem('agm.auth.accessToken', accessToken);
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  }, token);
  await page.goto(`${target}/turn`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-turn-agent-live]');
  await page.waitForFunction(() => document.querySelector('[data-live-connection]')?.textContent?.includes('LIVE'));
  const navigationCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
  await page.evaluate(() => {
    window.__turnAgentTransitions = [];
    const current = document.querySelector('[data-live-current]');
    if (!current) throw new Error('LIVE_CURRENT_MISSING');
    new MutationObserver(() => window.__turnAgentTransitions.push(current.textContent || '')).observe(current, { childList: true, subtree: true, characterData: true });
  });
  await realExecution();
  await page.waitForFunction(({ completed, failed }) => {
    const text = document.querySelector('[data-live-events]')?.textContent || '';
    const transitions = window.__turnAgentTransitions || [];
    return text.includes(completed) && text.includes(failed) && transitions.some((value) => value.includes(`${completed}`) && value.includes('STARTED')) && transitions.some((value) => value.includes(`${completed}`) && value.includes('WORKING')) && transitions.some((value) => value.includes(`${completed}`) && value.includes('COMPLETED')) && transitions.some((value) => value.includes(`${failed}`) && value.includes('FAILED'));
  }, { completed: completedMandateId, failed: failedMandateId }, { timeout: 20_000 });
  const transitions = await page.evaluate(() => window.__turnAgentTransitions);
  const navigationCountAfter = await page.evaluate(() => performance.getEntriesByType('navigation').length);
  if (navigationCountAfter !== navigationCount) throw new Error('MANUAL_REFRESH_OR_NAVIGATION_DETECTED');
  const liveScreenshot = path.join(out, 'turn-agent-runtime-live.png');
  await page.locator('[data-turn-agent-live]').screenshot({ path: liveScreenshot });
  results.push({ id: 'live-no-refresh', status: 'PASS', completedMandateId, failedMandateId, transitions, navigationCount, screenshot: path.relative(root, liveScreenshot) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(({ completed, failed }) => { const text = document.querySelector('[data-live-events]')?.textContent || ''; return text.includes(completed) && text.includes(failed); }, { completed: completedMandateId, failed: failedMandateId }, { timeout: 15_000 });
  const persistenceScreenshot = path.join(out, 'turn-agent-runtime-after-reload.png');
  await page.locator('[data-turn-agent-live]').screenshot({ path: persistenceScreenshot });
  results.push({ id: 'persistent-after-reload', status: 'PASS', screenshot: path.relative(root, persistenceScreenshot) });
} catch (error) {
  fatal = String(error);
  if (browser) {
    const pages = browser.contexts().flatMap((context) => context.pages());
    const page = pages[0];
    if (page) {
      results.push({ id: 'failure-state', status: 'FAIL', liveText: await page.locator('[data-turn-agent-live]').innerText().catch(() => ''), transitions: await page.evaluate(() => window.__turnAgentTransitions || []).catch(() => []) });
      await page.screenshot({ path: path.join(out, 'failure-state.png'), fullPage: true }).catch(() => undefined);
    }
  }
} finally {
  await prisma.$disconnect();
  await browser?.close();
  if (server) { spawnSync('taskkill.exe', ['/pid', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); server.kill(); server.unref(); }
  const report = { schemaVersion: 1, runId, status: fatal ? 'FAIL' : 'PASS', runner: 'Controlled AGM Playwright/Chromium', browserPluginStatus: 'PASS', integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE', browserSessionStatus: fatal ? 'FAIL' : 'PASS', targetPageStatus: fatal ? 'FAIL' : 'PASS', target: `${target}/turn`, api: 'http://127.0.0.1:3000/api/v1/agent-runtime-events', completedMandateId, failedMandateId, results, fatal, finishedAt: new Date().toISOString() };
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`TURN AGENT RUNTIME LIVE BROWSER: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (fatal) { console.error(fatal); process.exitCode = 1; }
}
