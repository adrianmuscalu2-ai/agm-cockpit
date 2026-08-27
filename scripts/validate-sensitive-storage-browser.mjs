import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'phase2-technical-closure', 'browser', runId);
const sensitiveKeys = [
  'agm.auth.rememberedEmail', 'agm.profile.settings', 'agm.contact-manager.contacts',
  'agm.ocr.history.v1', 'agm.turn.incident-journal.v1', 'agm.e6.pre-departure.session.v1',
  'agm.pre-departure.outbox.v1', 'agm.pre-departure.sync-ack.v1', 'agm.pre-departure.sync-meta.v1',
  'agm.poc02.after-departure.session.v1', 'agm.premium.trip-context.v1',
  'agm.premium.operational-events.v1', 'agm.premium.operational-outbox.v1',
  'agm.premium.operational-conflicts.v1', 'agm.premium.operational-case.v1',
  'agm.premium.field-batch-01.v1', 'agm.premium.field-batch-02.v1',
  'agm.premium.field-batch-02.safety.v1', 'agm.premium.communication-timeline.v1',
  'agm.premium.single-copilot.state.v1', 'agm.premium.voice.telemetry.v1',
  'agm.wave2b.communication-ledger.v1', 'agm.wave2d.conversational-routing.v1',
];

await mkdir(output, { recursive: true });
let browser;
let fatal;
const results = [];
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((keys) => {
    for (const key of keys) localStorage.setItem(key, JSON.stringify({ synthetic: true }));
  }, sensitiveKeys);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(750);
  const state = await page.evaluate((keys) => ({
    remainingSensitiveLocalKeys: keys.filter((key) => localStorage.getItem(key) !== null),
    localKeys: Object.keys(localStorage),
    sessionKeys: Object.keys(sessionStorage),
  }), sensitiveKeys);
  if (state.remainingSensitiveLocalKeys.length) {
    throw new Error(`SENSITIVE_LOCAL_KEYS_REMAIN:${state.remainingSensitiveLocalKeys.join(',')}`);
  }
  const screenshot = path.join(output, 'agm-sensitive-storage-cleanup.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  results.push({ id: 'legacy-sensitive-local-storage-cleanup', status: 'PASS', ...state, screenshot: path.relative(root, screenshot) });
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  const report = {
    schemaVersion: 1,
    runId,
    status: fatal ? 'FAIL' : 'PASS',
    runner: 'Controlled AGM Playwright/Chromium',
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: fatal ? 'FAIL' : 'PASS',
    targetPageStatus: fatal ? 'FAIL' : 'PASS',
    target: 'http://127.0.0.1:5174/',
    syntheticOnly: true,
    results,
    fatal,
    finishedAt: new Date().toISOString(),
  };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`SENSITIVE STORAGE BROWSER: ${report.status}\n${path.join(output, 'report.json')}\n`);
  if (fatal) process.exitCode = 1;
}
