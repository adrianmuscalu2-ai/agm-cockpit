import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';

const phase = String(process.argv[2] ?? '').toUpperCase();
const outputDirectory = resolve(process.argv[3] ?? '');
const targetUrl = process.argv[4] ?? 'https://app.agmcockpit.com/';
if (!['BEFORE', 'AFTER'].includes(phase)) throw new Error('OBSERVER_BROWSER_PHASE_MUST_BE_BEFORE_OR_AFTER');
if (!process.argv[3]) throw new Error('OBSERVER_BROWSER_OUTPUT_DIRECTORY_REQUIRED');
if (targetUrl !== 'https://app.agmcockpit.com/') throw new Error('OBSERVER_BROWSER_TARGET_MUST_BE_CANONICAL_PUBLIC_URL');

await mkdir(outputDirectory, { recursive: true });
const screenshotPath = join(outputDirectory, `browser-public-${phase.toLowerCase()}.png`);
const reportPath = join(outputDirectory, `browser-public-${phase.toLowerCase()}.json`);
const startedAt = new Date().toISOString();
const launchStarted = performance.now();
let browser;
let report;

try {
  browser = await chromium.launch({ headless: true });
  const launchMs = Math.round((performance.now() - launchStarted) * 1000) / 1000;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const navigationStartedAt = new Date().toISOString();
  const navigationStarted = performance.now();
  let response = null;
  let navigationError = null;
  try {
    response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  } catch (value) {
    navigationError = value instanceof Error ? { name: value.name, message: value.message } : { name: 'UNKNOWN', message: String(value) };
  }
  const navigationCompletedAt = new Date().toISOString();
  const navigationWallMs = Math.round((performance.now() - navigationStarted) * 1000) / 1000;
  const bodyVisible = navigationError === null ? await page.locator('body').isVisible().catch(() => false) : false;
  const bodyTextLength = bodyVisible ? (await page.locator('body').innerText().catch(() => '')).length : 0;
  const navigationTiming = navigationError === null ? await page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0];
    if (!entry) return null;
    return {
      type: entry.type,
      startTime: entry.startTime,
      duration: entry.duration,
      domainLookupMs: entry.domainLookupEnd - entry.domainLookupStart,
      connectMs: entry.connectEnd - entry.connectStart,
      tlsMs: entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0,
      requestToFirstByteMs: entry.responseStart - entry.requestStart,
      responseDownloadMs: entry.responseEnd - entry.responseStart,
      domContentLoadedMs: entry.domContentLoadedEventEnd - entry.startTime,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
    };
  }).catch(() => null) : null;
  if (bodyVisible) await page.screenshot({ path: screenshotPath, fullPage: false });
  const targetPagePass = navigationError === null && response?.status() === 200 && bodyVisible && bodyTextLength > 0;
  report = {
    contract: 'agm-instrumentation-observer-public-browser.v1',
    phase,
    generatedAt: new Date().toISOString(),
    runner: 'Controlled AGM Playwright/Chromium',
    targetUrl,
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: 'PASS',
    targetPageStatus: targetPagePass ? 'PASS' : 'FAIL',
    probe: {
      action: 'NAVIGATE_DOMCONTENTLOADED_AND_CAPTURE',
      startedAt,
      launchMs,
      navigationStartedAt,
      navigationCompletedAt,
      navigationWallMs,
      finalUrl: page.url(),
      httpStatus: response?.status() ?? null,
      bodyVisible,
      bodyTextLength,
      screenshot: bodyVisible ? screenshotPath : null,
      navigationTiming,
      error: navigationError,
    },
    custody: {
      p9: 'STOPPED',
      killSwitch: 'ACTIVE',
      officialBasicSloMs: 3000,
      officialBasicSloUnchanged: true,
      officialSoakRestarted: false,
      serviceStarted: false,
      faultInjection: false,
      externalWrites: 0,
    },
  };
  await context.close();
} catch (value) {
  report = {
    contract: 'agm-instrumentation-observer-public-browser.v1',
    phase,
    generatedAt: new Date().toISOString(),
    runner: 'Controlled AGM Playwright/Chromium',
    targetUrl,
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: 'FAIL',
    targetPageStatus: 'FAIL',
    probe: { action: 'NAVIGATE_DOMCONTENTLOADED_AND_CAPTURE', startedAt, error: value instanceof Error ? { name: value.name, message: value.message } : { name: 'UNKNOWN', message: String(value) } },
    custody: { p9: 'STOPPED', killSwitch: 'ACTIVE', officialBasicSloMs: 3000, officialBasicSloUnchanged: true, officialSoakRestarted: false, serviceStarted: false, faultInjection: false, externalWrites: 0 },
  };
} finally {
  await browser?.close();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`OBSERVER PUBLIC BROWSER - ${phase} / session=${report.browserSessionStatus} target=${report.targetPageStatus} latency=${report.probe.navigationWallMs ?? 'null'}ms`);
if (report.browserSessionStatus !== 'PASS' || report.targetPageStatus !== 'PASS') process.exitCode = 1;

