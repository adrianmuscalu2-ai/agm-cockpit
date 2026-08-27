import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.AGM_WEBSITE_AUDIT_URL ?? 'http://127.0.0.1:4321';
const evidenceDir = resolve('evidence/internal-total-audit-2026-08-15/browser-remediation-2026-08-16');
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const scenarios = [];
const viewports = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } };

try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const route of ['/', '/features/', '/privacy/', '/impressum/']) {
      const errors = [];
      page.removeAllListeners('console');
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await page.keyboard.press('Tab');
      const facts = await page.evaluate(() => ({
        title: document.title,
        lang: document.documentElement.lang,
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyText: document.body.innerText,
        activeTag: document.activeElement?.tagName ?? null,
      }));
      const slug = route === '/' ? 'home' : route.replaceAll('/', '');
      const screenshot = `${viewportName}-${slug}.png`;
      await page.screenshot({ path: resolve(evidenceDir, screenshot), fullPage: true });
      scenarios.push({
        viewport: viewportName, route, httpStatus: response?.status() ?? null,
        screenshot, consoleErrors: errors,
        checks: {
          http200: response?.status() === 200,
          noOverflow: facts.scrollWidth <= facts.clientWidth,
          encodingClean: !/[ÃÂÄÈ™È›]/.test(facts.title + facts.bodyText),
          noIndex: facts.robots === 'noindex, nofollow, noarchive',
          carMoverAbsent: !/car mover/i.test(facts.bodyText),
          keyboardFocus: facts.activeTag === 'A',
        }, facts: { ...facts, bodyText: undefined },
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: scenarios.length === 8 ? 'PASS' : 'FAIL',
  targetPageStatus: scenarios.every((item) => Object.values(item.checks).every(Boolean) && item.consoleErrors.length === 0) ? 'PASS' : 'FAIL',
  baseUrl,
  scenarios,
};
await writeFile(resolve(evidenceDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.targetPageStatus !== 'PASS') process.exitCode = 1;
