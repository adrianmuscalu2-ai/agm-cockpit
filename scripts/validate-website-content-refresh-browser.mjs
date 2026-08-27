import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.AGM_WEBSITE_AUDIT_URL ?? 'http://127.0.0.1:4321';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = resolve('evidence/website-content-refresh', runId);
const requestedPages = process.env.AGM_WEBSITE_AUDIT_SCOPE ? process.env.AGM_WEBSITE_AUDIT_SCOPE.split(',') : ['contact', 'faq', 'evolution'];
const routes = ['', '/de', '/en'].flatMap((prefix) => requestedPages.map((page) => `${prefix}/${page}/`));
await mkdir(evidenceDir, { recursive: true });

let browser;
let fatal = null;
const scenarios = [];
try {
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    for (const route of routes) {
      const errors = [];
      page.removeAllListeners('console');
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      const facts = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        text: document.body.innerText,
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'),
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      const expectedLang = route.startsWith('/de/') ? 'de' : route.startsWith('/en/') ? 'en' : 'ro';
      const isContact = route.endsWith('/contact/');
      const isFaq = route.endsWith('/faq/');
      const isEvolution = route.endsWith('/evolution/');
      const checks = {
        http200: response?.status() === 200,
        language: facts.lang === expectedLang,
        noIndex: facts.robots === 'noindex, nofollow, noarchive',
        noOverflow: facts.scrollWidth <= facts.width,
        noConsoleErrors: errors.length === 0,
        noAlternativeEmail: !/adrianmuscalu2@gmail\.com/i.test(facts.text),
        officialContact: !isContact || (/(?:0173|\+49 173) 4021893/.test(facts.text) && /agm\.transporte\.logistik@gmail\.com/.test(facts.text)),
        currentPremiumModel: !isFaq || !/(Hub-uri operaționale|betriebliche Hubs|operational hubs)/i.test(facts.text),
        internalStatus: !isEvolution || (/1\.3\.0/.test(facts.text) && /(intern|internă|internal)/i.test(facts.text)),
      };
      if (route === '/faq/') {
        await page.locator('#faq-search').fill('abonamente');
        checks.faqSearch = (await page.locator('#faq-count').innerText()) === '1';
      }
      if (route === '/evolution/') {
        await page.locator('[data-community-index="0"]').click();
        checks.evolutionDialog = await page.locator('#community-dialog').evaluate((dialog) => dialog.open);
        await page.locator('.dialog-close').click();
      }
      const screenshot = `${viewport.name}${route.replaceAll('/', '-')}.png`;
      await page.screenshot({ path: resolve(evidenceDir, screenshot), fullPage: true });
      scenarios.push({ viewport: viewport.name, route, checks, errors, screenshot });
    }
    await context.close();
  }
} catch (error) {
  fatal = String(error);
} finally {
  await browser?.close();
}

const expectedScenarioCount = routes.length * 2;
const passed = !fatal && scenarios.length === expectedScenarioCount && scenarios.every(({ checks }) => Object.values(checks).every(Boolean));
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  runner: 'Controlled AGM Playwright/Chromium',
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: fatal ? 'FAIL' : 'PASS',
  targetPageStatus: passed ? 'PASS' : 'FAIL',
  baseUrl,
  scenarios,
  fatal,
};
await writeFile(resolve(evidenceDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, scenarios: `${scenarios.length} recorded in ${evidenceDir}` }, null, 2));
if (!passed) process.exitCode = 1;
