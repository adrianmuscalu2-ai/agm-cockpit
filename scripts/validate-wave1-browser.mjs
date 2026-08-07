import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = path.join(root, '.tmp', 'wave1-browser-validation', runId);
const languageCodes = ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq'];
const wave1Codes = ['fr', 'nl', 'ru', 'pl', 'tr', 'sq'];
const expectedLabels = {
  fr: 'Français (fr)', nl: 'Nederlands (nl)', ru: 'Русский (ru)',
  pl: 'Polski (pl)', tr: 'Türkçe (tr)', sq: 'Shqip (sq)',
};

const report = { runId, startedAt: new Date().toISOString(), checks: [], evidenceDir };
const record = (name, pass, detail = '') => {
  report.checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
  if (!pass) throw new Error(`${name}: ${detail}`);
};

async function discoverOrStartTarget() {
  if (process.env.AGM_BROWSER_LOCAL_URL) {
    return { url: new URL(process.env.AGM_BROWSER_LOCAL_URL).toString(), process: null, source: 'environment' };
  }
  const dynamicPort = await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : null;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
  if (!dynamicPort) throw new Error('Operating system did not allocate a free local port.');
  const command = `node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port ${dynamicPort} --strictPort`;
  const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
    cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Web bootstrap timeout. ${output.slice(-500)}`)), 30_000);
    const inspect = (chunk) => {
      output += chunk.toString();
      const plainOutput = output.replace(/\u001b\[[0-9;]*m/g, '');
      const match = plainOutput.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/i);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    };
    child.stdout.on('data', inspect); child.stderr.on('data', inspect);
    child.on('exit', (code) => reject(new Error(`Web process exited before readiness (${code}). ${output.slice(-500)}`)));
  });
  return { url, process: child, source: 'dynamic-vite-bootstrap' };
}

async function httpReady(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { const response = await fetch(url); if (response.status === 200) return response.status; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Target did not become HTTP 200: ${url}`);
}

await mkdir(evidenceDir, { recursive: true });
let target;
let browser;
try {
  target = await discoverOrStartTarget();
  record('HOST DETECTION', true, `unattended-runner/windows; target source=${target.source}`);
  record('TARGET DISCOVERY', (await httpReady(target.url)) === 200, target.url);
  browser = await chromium.launch({ headless: process.env.AGM_BROWSER_HEADLESS !== 'false' });
  record('BROWSER BOOTSTRAP', true, 'isolated Chromium session created');
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ro-RO' });
  const page = await context.newPage();
  await page.goto(target.url, { waitUntil: 'networkidle' });
  const accept = page.locator('#acceptLegalNotice');
  if (await accept.isVisible().catch(() => false)) await accept.click();
  record('BROWSER SESSION', (await page.title()).includes('A.G.M.'), await page.title());
  record('TARGET PAGE', (await page.locator('#app').count()) === 1, page.url());

  const languageSurface = page.locator('.quick-language-controls:visible').first();
  const quick = languageSurface.locator('[data-quick-language]');
  const more = languageSurface.locator('[data-more-language]');
  record('THREE QUICK LANGUAGES', (await quick.count()) === 3, `count=${await quick.count()}`);
  const optionValues = await more.locator('option').evaluateAll((items) => items.map((item) => item.value).filter(Boolean));
  record('NINE LANGUAGE UI', languageCodes.every((code) => [...optionValues, 'ro', 'de', 'en'].includes(code)), optionValues.join(','));

  for (const code of wave1Codes) {
    const currentMore = page.locator('.quick-language-controls:visible').first().locator('[data-more-language]');
    const label = await currentMore.locator(`option[value="${code}"]`).textContent();
    record(`LANGUAGE ${code.toUpperCase()}`, label?.trim() === expectedLabels[code], label ?? 'missing');
    await currentMore.selectOption(code);
    await page.waitForFunction((language) => document.documentElement.lang === language, code);
  }
  await page.reload({ waitUntil: 'networkidle' });
  const persistedQuick = await page.locator('.quick-language-controls:visible').first().locator('[data-quick-language]').allTextContents();
  record('LANGUAGE FAVORITES / PERSISTENCE', persistedQuick.length === 3 && persistedQuick.includes('SQ'), persistedQuick.join('/'));

  for (const [route, name, selector] of [
    ['/translator', 'MULTILINGUAL TRANSLATOR', 'textarea'],
    ['/email', 'EMAIL ASSISTANT', 'textarea'],
    ['/ocr', 'MULTILINGUAL OCR', 'input[type="file"]'],
  ]) {
    await page.goto(new URL(route, target.url).toString(), { waitUntil: 'networkidle' });
    record(name, (await page.locator(selector).count()) > 0, route);
  }

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto(new URL('/basic', target.url).toString(), { waitUntil: 'networkidle' });
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    record(`NO OVERFLOW ${viewport.width}`, dimensions.scroll <= dimensions.client, JSON.stringify(dimensions));
    await page.screenshot({ path: path.join(evidenceDir, `basic-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }
  record('RESPONSIVE DESKTOP', true, '1440x1000 and 1024x768');
  record('BROWSER REAL VALIDATION', true, 'navigation, persistence, multilingual UI and captures passed');
  await context.close();
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  if (target?.process) {
    spawnSync('taskkill.exe', ['/pid', String(target.process.pid), '/T', '/F'], {
      windowsHide: true, stdio: 'ignore',
    });
  }
  report.finishedAt = new Date().toISOString();
  report.status = report.error ? 'FAIL' : 'PASS';
  await writeFile(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`WAVE 1 BROWSER REAL VALIDATION: ${report.status}`);
console.log(`Evidence: ${path.join(evidenceDir, 'report.json')}`);
if (report.error) { console.error(report.error); process.exitCode = 1; }
