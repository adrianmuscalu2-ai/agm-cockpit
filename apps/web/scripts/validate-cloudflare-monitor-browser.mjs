import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const outputDirectory = path.join(repositoryRoot, 'evidence', 'cloudflare-monitor-false-offline-remediation');
const target = 'http://127.0.0.1:5174/';
await mkdir(outputDirectory, { recursive: true });

const viteEntry = path.join(repositoryRoot, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
const server = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', '5174'], {
  cwd: path.join(repositoryRoot, 'apps', 'web'),
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

async function waitForTarget() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(500) });
      if (response.status === 200) return;
    } catch { /* target is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Controlled target did not become ready on strict port 5174.\n${serverOutput.slice(-2_000)}`);
}

let browser;
try {
  await waitForTarget();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'ro-RO' });
  await page.route('**/production-app/turn', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>AGM Cockpit Turn</title>' });
  });
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [{ renderMonitoringDepartment }, { bindOperationsHealthChecks }] = await Promise.all([
      import('/src/monitoring-department.ts'),
      import('/src/operations-health.ts'),
    ]);
    document.body.innerHTML = `<main>${renderMonitoringDepartment([])}</main>`;
    bindOperationsHealthChecks();
  });

  const card = page.locator('[data-operation-id="cloudflare-public"]');
  await card.locator('.operation-service-status').filter({ hasText: 'ONLINE' }).waitFor();
  const before = await card.locator('.operation-service-checked').textContent();
  await page.waitForTimeout(1_100);
  await card.locator('[data-operation-recheck="cloudflare-public"]').click();
  await page.waitForFunction((previous) => {
    const value = document.querySelector('[data-operation-id="cloudflare-public"] .operation-service-checked')?.textContent;
    return Boolean(value && value !== previous);
  }, before);

  const result = await card.evaluate((element) => ({
    status: element.querySelector('.operation-service-status')?.textContent?.trim(),
    freshness: element.querySelector('.operation-service-freshness')?.textContent?.trim(),
    outcome: element.querySelector('.operation-service-outcome')?.textContent?.trim(),
    effectiveUrl: element.querySelector('.operation-service-effective-url')?.textContent?.trim(),
    checkedAt: element.querySelector('.operation-service-checked')?.textContent?.trim(),
    lastSuccess: element.querySelector('.operation-service-last-success')?.textContent?.trim(),
    latency: element.querySelector('.operation-service-latency')?.textContent?.trim(),
  }));
  if (result.status !== 'ONLINE' || result.freshness !== 'LIVE' || result.outcome !== 'HTTP_STATUS') throw new Error(JSON.stringify(result));
  if (result.effectiveUrl !== 'https://app.agmcockpit.com/turn' || !result.lastSuccess || result.lastSuccess.includes('Niciun')) throw new Error(JSON.stringify(result));
  await card.screenshot({ path: path.join(outputDirectory, 'mon-008-recheck.png') });
  await writeFile(path.join(outputDirectory, 'browser-result.json'), JSON.stringify({ checkedAt: new Date().toISOString(), target, result, verdict: 'PASS' }, null, 2));
  console.log(JSON.stringify({ BrowserSessionStatus: 'PASS', TargetPageStatus: 'PASS', recheck: 'PASS', result }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
}
