import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const target = process.env.AGM_OCR_TARGET ?? 'http://127.0.0.1:56124';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'global-camera-ocr', 'desktop-browser', runId);
const report = { schemaVersion: 1, runId, target, status: 'FAIL', checks: [], diagnostics: [] };
let browser;
let server;

await mkdir(output, { recursive: true });

async function ready() {
  try { return (await fetch(target, { signal: AbortSignal.timeout(1000) })).status === 200; }
  catch { return false; }
}

async function startTarget() {
  if (await ready()) return;
  const vite = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
  server = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '56124', '--strictPort'], {
    cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Desktop OCR target did not become ready.');
}

try {
  await startTarget();
  browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ro-RO',
    permissions: ['camera'],
  });
  await context.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({
      privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString(),
    }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });

  const fixturePage = await context.newPage();
  await fixturePage.evaluate(() => {
    document.body.innerText = 'AGM DOCUMENT CMR 12345 DESKTOP OCR TEST';
    document.body.style.cssText = 'padding:90px;background:white;color:black;font:80px Arial';
  });
  const fixture = path.join(output, 'desktop-document.png');
  await fixturePage.screenshot({ path: fixture });
  await fixturePage.close();

  const page = await context.newPage();
  page.on('pageerror', (error) => report.diagnostics.push({ type: 'pageerror', message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') report.diagnostics.push({ type: 'console-error', message: message.text() });
  });

  await page.goto(`${target}/basic`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const action = page.locator('[data-global-action=ocr]');
  await action.waitFor({ state: 'visible', timeout: 30000 });
  report.checks.push({ id: 'desktop-global-ocr-action-visible', status: 'PASS' });
  await action.click();
  await page.locator('.global-ocr-dialog').waitFor({ state: 'visible' });
  report.checks.push({ id: 'desktop-dialog-opens', status: 'PASS' });

  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#globalOcrChooseImage').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(fixture);
  await page.locator('#globalOcrDialogText').waitFor({ state: 'visible', timeout: 120000 });
  const text = await page.locator('#globalOcrDialogText').inputValue();
  if (!/AGM|DOCUMENT|CMR/i.test(text)) throw new Error(`Desktop file OCR failed: ${text}`);
  report.checks.push({ id: 'desktop-file-selection-real-ocr', status: 'PASS', text });

  await page.locator('#globalOcrDone').click();
  await action.click();
  await page.locator('#globalOcrTakePhoto').click();
  const webcam = page.locator('.browser-camera-capture-dialog');
  await webcam.waitFor({ state: 'visible', timeout: 15000 });
  const dimensions = await page.locator('#browserCameraPreview').evaluate((video) => ({
    width: video.videoWidth,
    height: video.videoHeight,
    readyState: video.readyState,
  }));
  if (!dimensions.width || !dimensions.height || dimensions.readyState < 2) {
    throw new Error(`Desktop webcam stream was not ready: ${JSON.stringify(dimensions)}`);
  }
  await page.screenshot({ path: path.join(output, 'desktop-webcam-preview.png'), fullPage: true });
  report.checks.push({ id: 'desktop-webcam-preview', status: 'PASS', dimensions });

  await page.locator('#browserCameraShutter').click();
  await webcam.waitFor({ state: 'detached', timeout: 15000 });
  await page.locator('.global-ocr-progress, .global-ocr-failure, #globalOcrDialogText').first().waitFor({ state: 'visible', timeout: 120000 });
  report.checks.push({ id: 'desktop-webcam-capture-processed', status: 'PASS' });
  report.status = report.diagnostics.some((entry) => entry.type === 'pageerror') ? 'FAIL' : 'PASS';
} catch (error) {
  report.fatal = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  await browser?.close();
  if (server && !server.killed) server.kill();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`GLOBAL CAMERA/OCR DESKTOP BROWSER: ${report.status}`);
  console.log(path.join(output, 'report.json'));
  if (report.status !== 'PASS') process.exitCode = 1;
}
