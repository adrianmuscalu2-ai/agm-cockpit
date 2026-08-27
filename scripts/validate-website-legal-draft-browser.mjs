import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.AGM_WEBSITE_AUDIT_URL ?? 'http://127.0.0.1:4321';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = resolve('evidence/website-legal-draft', runId);
const routes = ['', '/de', '/en'].flatMap((prefix) => ['impressum', 'privacy', 'terms'].map((page) => `${prefix}/${page}/`));
await mkdir(evidenceDir, { recursive: true });

let browser;
const scenarios = [];
let fatal = null;
try {
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    for (const route of routes) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      const facts = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'),
        text: document.body.innerText,
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      const officialIdentity = /A\.G\.M\. Transporten/.test(facts.text)
        && /Alexandru-Adrian Muscalu/.test(facts.text)
        && /Staufenbergstraße 72/.test(facts.text)
        && /74081 Heilbronn/.test(facts.text)
        && /0173 4021893/.test(facts.text)
        && /agm\.transporte\.logistik@gmail\.com/.test(facts.text);
      const noUnapprovedContact = !/(adrianmuscalu2|wa\.me)/i.test(facts.text);
      const statusPresent = /(DRAFT INTERN|INTERNER ENTWURF|INTERNAL DRAFT)/.test(facts.text);
      const noCommerce = !/(checkout|subscribe now|jetzt abonnieren|abonează-te acum)/i.test(facts.text);
      const expectedLang = route.startsWith('/de/') ? 'de' : route.startsWith('/en/') ? 'en' : 'ro';
      const checks = {
        http200: response?.status() === 200,
        language: facts.lang === expectedLang,
        noIndex: facts.robots === 'noindex, nofollow, noarchive',
        noOverflow: facts.scrollWidth <= facts.width,
        officialIdentity,
        noUnapprovedContact,
        internalDraftStatus: statusPresent,
        noCommercialActivation: noCommerce,
      };
      const slug = route.replaceAll('/', '-') || '-home';
      const screenshot = `${viewport.name}${slug}.png`;
      await page.screenshot({ path: resolve(evidenceDir, screenshot), fullPage: true });
      scenarios.push({ viewport: viewport.name, route, checks, screenshot });
    }
    await context.close();
  }
} catch (error) {
  fatal = String(error);
} finally {
  await browser?.close();
}

const passed = !fatal && scenarios.length === 18 && scenarios.every(({ checks }) => Object.values(checks).every(Boolean));
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
