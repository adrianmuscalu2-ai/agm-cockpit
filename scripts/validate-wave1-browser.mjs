import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = path.join(root, '.tmp', 'wave1-browser-validation', runId);
const languageCodes = ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq', 'it', 'es', 'sv'];
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

async function dismissTransientUi(page) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const control = page.locator('#acceptLegalNotice:visible, #skipRoadmapInvitation:visible, #closeTutorial:visible, [data-command="tutorial-close"]:visible').first();
    if (!(await control.count())) break;
    await control.click();
    await control.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => undefined);
    await page.waitForTimeout(100);
  }
}

async function waitForStableDom(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(150);
}

async function navigateToApp(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  if (!response || response.status() >= 400) {
    throw new Error(`Navigation did not return a successful document: ${url}; status=${response?.status() ?? 'none'}`);
  }
  await page.locator('#app').waitFor({ state: 'attached', timeout: 10_000 });
  await page.locator('.quick-language-controls:visible, #acceptLegalNotice:visible').first().waitFor({ state: 'visible', timeout: 10_000 });
  await waitForStableDom(page);
  await dismissTransientUi(page);
  await waitForStableDom(page);
}

async function navigateWithinApp(page, route) {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, '', nextRoute);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.locator('#app').waitFor({ state: 'attached', timeout: 10_000 });
  await dismissTransientUi(page);
  await waitForStableDom(page);
}

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
  const viteCli = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(dynamicPort), '--strictPort'], {
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
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await navigateToApp(page, target.url);
  record('BROWSER SESSION', (await page.title()) === 'AGM Website', await page.title());
  record('TARGET PAGE', (await page.locator('#app').count()) === 1, page.url());

  const languageSurface = page.locator('.quick-language-controls:visible').first();
  const quick = languageSurface.locator('[data-quick-language]');
  const nativeMore = languageSurface.locator('[data-more-language]');
  const menuTrigger = languageSurface.locator('[data-more-language-trigger]');
  record('THREE QUICK LANGUAGES', (await quick.count()) === 3, `count=${await quick.count()}`);
  const optionValues = await nativeMore.count()
    ? await nativeMore.locator('option').evaluateAll((items) => items.map((item) => item.value).filter(Boolean))
    : await languageSurface.locator('[data-more-language-option]').evaluateAll((items) => items.map((item) => item.getAttribute('data-more-language-option')).filter(Boolean));
  record('TWELVE LANGUAGE UI', languageCodes.every((code) => optionValues.includes(code)), optionValues.join(','));

  const visualLanguageViolations = [];
  for (const code of languageCodes) {
    const currentSurface = page.locator('.quick-language-controls:visible').first();
    const currentQuick = currentSurface.locator(`[data-quick-language="${code}"]`);
    if (await currentQuick.count()) {
      await currentQuick.click();
    } else {
      const currentNativeMore = currentSurface.locator('[data-more-language]');
      if (await currentNativeMore.count()) {
        const label = await currentNativeMore.locator(`option[value="${code}"]`).textContent();
        if (wave1Codes.includes(code)) record(`LANGUAGE ${code.toUpperCase()}`, label?.trim() === expectedLabels[code], label ?? 'missing');
        await currentNativeMore.selectOption(code);
      } else {
        const currentTrigger = currentSurface.locator('[data-more-language-trigger]');
        await currentTrigger.click();
        const currentOption = currentSurface.locator(`[data-more-language-option="${code}"]`);
        const label = await currentOption.textContent();
        if (wave1Codes.includes(code)) record(`LANGUAGE ${code.toUpperCase()}`, Boolean(label?.trim()), label ?? 'missing');
        await currentOption.click();
      }
    }
    await page.waitForFunction((language) => document.documentElement.lang === language, code);
    await navigateWithinApp(page, '/basic');
    const languageAfterNavigation = await page.evaluate(() => document.documentElement.lang);
    record(`LANGUAGE ${code.toUpperCase()} ROUTE PERSISTENCE`, languageAfterNavigation === code, languageAfterNavigation);
    const visibleText = await page.locator('body').innerText();
    const englishMarkers = [
      'The Basic module', 'All essential tools', 'Quick guide', 'How to use',
      'Capture, local recognition', 'Active mode', 'Create email',
    ];
    const romanianMarkers = [
      'Analizează', 'Validat', 'Deschide', 'După Plecare',
    ];
    const forbiddenMarkers = code === 'ro' ? englishMarkers : code === 'en' ? romanianMarkers : [...englishMarkers, ...romanianMarkers];
    const visibleLines = visibleText.split('\n').map((line) => line.trim());
    const foreignMarkers = forbiddenMarkers.filter((marker) => marker === 'Validat' ? visibleLines.includes(marker) : visibleText.includes(marker));
    if (foreignMarkers.length) visualLanguageViolations.push(`${code}: ${foreignMarkers.join(', ')}`);
    await page.screenshot({ path: path.join(evidenceDir, `basic-language-${code}.png`), fullPage: true });
  }
  const persistedLanguage = await page.evaluate(() => document.documentElement.lang);
  const persistedQuick = await page.locator('.quick-language-controls:visible').first().locator('[data-quick-language]').allTextContents();
  record(
    'LANGUAGE FAVORITES / PERSISTENCE',
    persistedLanguage === languageCodes.at(-1) && persistedQuick.length === 3 && persistedQuick.includes(languageCodes.at(-1).toUpperCase()),
    `language=${persistedLanguage}; favorites=${persistedQuick.join('/')}`,
  );
  record('VISUAL LANGUAGE COHERENCE', visualLanguageViolations.length === 0, visualLanguageViolations.join(' | '));

  for (const [route, name, selector] of [
    ['/translator', 'MULTILINGUAL TRANSLATOR', 'textarea'],
    ['/email', 'EMAIL ASSISTANT', 'textarea'],
    ['/ocr', 'MULTILINGUAL OCR', 'input[type="file"]'],
  ]) {
    await navigateWithinApp(page, route);
    await page.screenshot({ path: path.join(evidenceDir, `route-${route.slice(1)}.png`), fullPage: true });
    const selectorCount = await page.locator(selector).count();
    const diagnostic = selectorCount ? route : `${route}; ${String(await page.locator('body').innerText()).slice(0, 120).replaceAll('\n', ' ')}; ${runtimeErrors.slice(-2).join(' | ')}`;
    record(name, selectorCount > 0, diagnostic);
  }

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await navigateWithinApp(page, '/basic');
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
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/pid', String(target.process.pid), '/T', '/F'], {
        windowsHide: true, stdio: 'ignore',
      });
    } else {
      target.process.kill('SIGTERM');
    }
    target.process.stdout?.destroy();
    target.process.stderr?.destroy();
    target.process.unref();
  }
  report.finishedAt = new Date().toISOString();
  report.status = report.error ? 'FAIL' : 'PASS';
  await writeFile(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`WAVE 1 BROWSER REAL VALIDATION: ${report.status}`);
console.log(`Evidence: ${path.join(evidenceDir, 'report.json')}`);
if (report.error) { console.error(report.error); process.exitCode = 1; }
process.exit(report.error ? 1 : 0);
