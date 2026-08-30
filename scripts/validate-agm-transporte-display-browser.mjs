import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'agm-transporte-display', runId);
const target = 'http://127.0.0.1:5174/about';
const report = { runId, target, status: 'FAIL' };
let browser;

await mkdir(output, { recursive: true });
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    sessionStorage.setItem('agm.profile.preferredLanguage', 'ro');
  });
  const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('.about-app').waitFor({ state: 'visible', timeout: 15_000 });
  const state = {
    http: response?.status(),
    title: await page.title(),
    heading: await page.locator('.about-app h1').textContent(),
    relationship: await page.locator('.about-brand-relation').textContent(),
    version: await page.locator('.about-app .profile-heading > span').textContent(),
  };
  if (state.http !== 200 || state.title !== 'AGM Transporte' || state.relationship !== 'A.G.M. Cockpit — parte din ecosistemul AGM Transporte.' || state.version !== 'A.G.M. Cockpit 1.3.0') {
    throw new Error(`Display contract mismatch: ${JSON.stringify(state)}`);
  }
  const screenshot = path.join(output, 'about-desktop.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  Object.assign(report, { status: 'PASS', state, screenshot: path.relative(root, screenshot) });
} catch (error) {
  report.error = String(error?.stack || error);
} finally {
  await browser?.close();
  report.finishedAt = new Date().toISOString();
  const reportPath = path.join(output, 'report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`AGM TRANSPORTE DISPLAY: ${report.status}`);
  console.log(reportPath);
  if (report.status !== 'PASS') process.exitCode = 1;
}
