import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'browser-control', 'p9-turn-visibility', runId);
const target = process.argv[2] ?? 'http://127.0.0.1:5174/turn';
await mkdir(output, { recursive: true });
const viteEntry = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
let server = null;
const targetReady = async () => { try { return (await fetch(target, { signal: AbortSignal.timeout(800) })).status === 200; } catch { return false; } };
if (!await targetReady()) {
  server = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 100 && !await targetReady(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 250));
  if (!await targetReady()) throw new Error('CONTROLLED_TARGET_5174_UNAVAILABLE');
}
let browser;
let fatal = null;
const results = [];
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const response = await page.goto(target, { waitUntil: 'networkidle', timeout: 45_000 });
  if (!response?.ok()) throw new Error(`TARGET_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  for (const selector of ['#acceptLegalNotice', '#closeTutorial', '#skipRoadmapInvitation']) {
    const control = page.locator(selector);
    if (await control.isVisible().catch(() => false)) await control.click();
  }
  const card = page.locator('#turn-p9');
  await card.waitFor({ state: 'visible' });
  const dashboard = page.locator('.turn-command-center');
  const operations = page.locator('#turn-operations');
  const organization = page.locator('#turn-structure');
  const registryRows = page.locator('[data-agent-row-id]');
  const organizationNodes = page.locator('[data-turn-org-agent]');
  const directoryAgents = page.locator('[data-entry-agent-id]');
  if (!await dashboard.isVisible()) throw new Error('TURN_DASHBOARD_NOT_VISIBLE');
  if (!await operations.isVisible()) throw new Error('TURN_OPERATIONAL_PANEL_NOT_VISIBLE');
  if (!await organization.isVisible()) throw new Error('TURN_ORGANIZATION_NOT_VISIBLE');
  if (await page.locator('[data-status-kind]').count() < 3) throw new Error('TURN_STATUS_LIGHTS_MISSING');
  if (await registryRows.count() !== 31) throw new Error(`TURN_AGENT_REGISTRY_COUNT_${await registryRows.count()}`);
  if (await organizationNodes.count() < 20) throw new Error('TURN_ORGANIZATION_NODES_INCOMPLETE');
  if (await directoryAgents.count() !== 32) throw new Error(`TURN_AGENT_DIRECTORY_COUNT_${await directoryAgents.count()}`);
  if (await page.locator('a[href="#turn-dashboard"]', { hasText: 'Agent Directory' }).count() !== 1) throw new Error('TURN_AGENT_DIRECTORY_NAVIGATION_MISSING');
  const networkFirst = await page.evaluate(() => {
    const network = document.querySelector('#turn-dashboard');
    const technical = document.querySelector('#turn-operations');
    return Boolean(network && technical && (network.compareDocumentPosition(technical) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  if (!networkFirst) throw new Error('TURN_AGENT_NETWORK_NOT_FIRST');
  if (await page.locator('.turn-agent-light .turn-light').count() !== 32) throw new Error('TURN_ALL_AGENT_LIGHTS_MISSING');
  if (await page.locator('.turn-independent-monitor', { hasText: 'CONTROL INDEPENDENT' }).count() !== 1) throw new Error('TURN_INDEPENDENT_MONITOR_MISSING');
  if (await page.locator('.turn-governance-rails article').count() !== 4) throw new Error('TURN_GOVERNANCE_INCOMPLETE');
  const p9Registry = page.locator('.ai-network .p9-network-position');
  const p9RegistryText = await p9Registry.evaluate((element) => element.textContent ?? '');
  if (await p9Registry.count() !== 1 || !p9RegistryText.includes('Rețeaua AI')) throw new Error('P9_ORGANIZATIONAL_POSITION_INVALID');
  await page.waitForFunction(() => document.querySelector('#turn-p9')?.getAttribute('data-p9-projection') === 'live');
  const verify = async (stage) => {
    const text = await card.innerText();
    for (const expected of ['P9 — ACTIVE', '5/5 PASS', 'ACTIVE', 'READY', '0/0', 'OPERATIONAL_EVIDENCE']) {
      if (!text.includes(expected)) throw new Error(`${stage}_MISSING_${expected}`);
    }
    return text;
  };
  await verify('INITIAL');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#turn-p9')?.getAttribute('data-p9-projection') === 'live');
  const refreshedText = await verify('REFRESH');
  await dashboard.scrollIntoViewIfNeeded();
  const screenshot = path.join(output, 'turn-dashboard-approved.png');
  await page.locator('#turn-dashboard').screenshot({ path: screenshot, animations: 'disabled' });
  results.push({ id: 'turn-live-dashboard-complete', status: 'PASS', route: page.url(), approvedAgents: 31, p9Agents: 1, entrySignals: await directoryAgents.count(), registryAgents: await registryRows.count(), organizationNodes: await organizationNodes.count(), independentMonitor: true, governanceRails: 4, networkFirst: true, screenshot: path.relative(root, screenshot) });
  results.push({ id: 'p9-visible-and-refresh-stable', status: 'PASS', route: page.url(), organizationalPosition: 'AI → Copilot Control Plane', source: 'OPERATIONAL_EVIDENCE', screenshot: path.relative(root, screenshot), text: refreshedText });
} catch (error) {
  fatal = String(error instanceof Error ? error.stack ?? error.message : error);
} finally {
  await browser?.close();
  server?.kill();
  const report = {
    schemaVersion: 1, runId, status: fatal ? 'FAIL' : 'PASS', runner: 'Controlled AGM Playwright/Chromium',
    browserPluginStatus: 'PASS', integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: fatal ? 'FAIL' : 'PASS', targetPageStatus: fatal ? 'FAIL' : 'PASS', target, results, fatal,
    finishedAt: new Date().toISOString(),
  };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`P9 TURN VISIBILITY BROWSER: ${report.status}`);
  console.log(path.join(output, 'report.json'));
  if (fatal) process.exitCode = 1;
}
