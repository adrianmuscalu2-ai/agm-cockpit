import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'field-test-batch-02', 'desktop', runId);
const target = 'http://127.0.0.1:5174/';
const route = new URL('/after-departure.html', target).toString();
const flows = ['incident-accident', 'vehicle-breakdown', 'driver-fatigue', 'cargo-issue', 'route-blocked', 'weather-road', 'language-barrier', 'route-document', 'independent-communication', 'arrival-closeout', 'final-report-archive'];
const results = [];
let server = null;
let browser = null;
let fatal = null;

await mkdir(out, { recursive: true });
const ready = async () => { try { return (await fetch(target)).status === 200; } catch { return false; } };
async function start() {
  if (await ready()) return;
  server = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port 5174 --strictPort'], { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' });
  for (let i = 0; i < 80; i += 1) { if (await ready()) return; await new Promise((resolve) => setTimeout(resolve, 250)); }
  throw new Error('Target 5174 unavailable');
}
const check = (value, message) => { if (!value) throw new Error(message); };
async function shot(page, id, detail) {
  const file = path.join(out, `${id}.png`);
  await page.screenshot({ path: file, fullPage: true });
  results.push({ id, status: 'PASS', detail, url: page.url(), screenshot: path.relative(root, file), finishedAt: new Date().toISOString() });
}

try {
  await start();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'ro-RO' });
  const page = await context.newPage();
  const batch = page.locator('agm-after-field-batch');
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.removeItem('agm.premium.field-batch-02.v1'); localStorage.removeItem('agm.premium.field-batch-02.active'); localStorage.removeItem('agm.premium.field-batch-02.safety.v1'); localStorage.setItem('agm.premium.language', 'ro'); });
  await page.reload({ waitUntil: 'networkidle' });

  await batch.locator('[data-safe="false"]').click();
  check(await batch.locator('[role="alert"]').isVisible(), 'unsafe instruction missing');
  check(await batch.locator('[data-after-situation]').count() === 0, 'selector exposed while unsafe');
  await shot(page, '10-unsafe-interaction', 'unsafe response locks every operational control');

  await batch.locator('[data-safe="true"]').click();
  await batch.locator('[data-danger="true"]').click();
  check(await batch.locator('a[href="tel:112"]').isVisible(), '112 unavailable');
  check(await batch.locator('[data-after-situation]').count() === 0, 'selector exposed during emergency');
  await shot(page, '11-immediate-danger', 'emergency gate exposes only approved emergency action');

  await batch.locator('[data-danger="false"]').click();
  for (let i = 0; i < flows.length; i += 1) {
    const id = flows[i];
    await batch.locator('[data-after-situation]').selectOption(id);
    await batch.locator('[data-facts]').fill(`confirmed field facts ${i + 1}`);
    await batch.locator('[data-facts]').blur();
    await batch.locator('[data-human]').check();
    if (id === 'independent-communication') {
      await batch.locator('[data-channel="email"]').click();
      await batch.locator('[data-prepare]').click();
      await batch.locator('[data-confirm-external]').click();
    }
    await batch.locator('[data-disposition="RESOLVED"]').click();
    const saved = await page.evaluate(({ id: situationId }) => JSON.parse(localStorage.getItem('agm.premium.field-batch-02.v1') || '{}')[situationId], { id });
    check(saved.state === 'RESOLVED', `${id} unresolved`);
    check(saved.data.humanConfirmed === true, `${id} human confirmation missing`);
    check(!saved.externalEffects.some((effect) => effect.phase === 'SENT' || effect.phase === 'RECEIPT_CONFIRMED'), `${id} automatic send`);
    await shot(page, `${String(i + 12).padStart(2, '0')}-${id}`, `${id} resolved with human confirmation and no automatic send`);
  }
  const all = await page.evaluate(() => JSON.parse(localStorage.getItem('agm.premium.field-batch-02.v1') || '{}'));
  check(Object.keys(all).length === 11, '11 cases not persisted');
  await page.reload({ waitUntil: 'networkidle' });
  check(await batch.locator('[data-after-situation]').inputValue() === 'final-report-archive', 'active case not recovered after refresh');
  await context.close();
} catch (error) {
  fatal = String(error);
} finally {
  await browser?.close();
  if (server) spawnSync('taskkill.exe', ['/pid', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  const report = { schemaVersion: 1, runId, status: !fatal && results.length === 13 && results.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL', runner: 'Controlled AGM Playwright/Chromium', target, route, viewport: '412x915 Android-first', results, noFabricatedPass: results.length === 13 && results.every((result) => result.status === 'PASS'), fatal, finishedAt: new Date().toISOString() };
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(out, 'runner.log.jsonl'), `${results.map((result) => JSON.stringify(result)).join('\n')}\n`);
  console.log(`FIELD TEST BATCH 02 DESKTOP: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (report.status !== 'PASS') process.exitCode = 1;
}
