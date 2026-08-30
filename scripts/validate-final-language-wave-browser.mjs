import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const webRoot = path.join(root, 'apps', 'web');
const webRequire = createRequire(path.join(webRoot, 'package.json'));
const { createServer: createViteServer } = await import(pathToFileURL(webRequire.resolve('vite')).href);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = path.join(root, 'evidence', 'app-i18n', 'browser', runId);
const target = 'http://127.0.0.1:5174/';
const languages = {
  it: { profile:'Lingua preferita', access:'Accesso e abbonamento', accessReady:'Accesso Premium valido.', basic:'Traduttore contestuale', premium:'Ecosistema premium', carMover:'Pianifica, confronta ed esegui gli spostamenti dei veicoli usando dati AGM reali.' },
  es: { profile:'Idioma preferido', access:'Acceso y suscripción', accessReady:'Acceso Premium válido.', basic:'Traductor contextual', premium:'Ecosistema premium', carMover:'Planifica, compara y ejecuta movimientos de vehículos con datos reales de AGM.' },
  sv: { profile:'Önskat språk', access:'Åtkomst och abonnemang', accessReady:'Premium-åtkomst giltig.', basic:'Kontextöversättare', premium:'Premium-ekosystem', carMover:'Planera, jämför och utför fordonsförflyttningar med verkliga AGM-data.' },
};
const viewports = {
  desktop: { width:1440, height:1000 },
  mobile: { width:412, height:915 },
};
const results = [];
const runtimeErrors = [];
const report = {
  schemaVersion:1, runId, startedAt:new Date().toISOString(), target,
  runner:'Controlled AGM Playwright/Chromium',
  browserPluginStatus:'PASS',
  integratedBrowserControlStatus:'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus:'FAIL', targetPageStatus:'FAIL', results,
};
let viteServer;
let browser;
let fatal;

await mkdir(evidenceDir, { recursive:true });
try {
  viteServer = await createViteServer({ root:webRoot, server:{ host:'127.0.0.1', port:5174, strictPort:true }, logLevel:'silent' });
  await viteServer.listen();
  await httpReady(target);
  browser = await chromium.launch({ headless:true });
  report.browserSessionStatus = 'PASS';

  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const [language, expected] of Object.entries(languages)) {
      const context = await browser.newContext({ viewport, locale:`${language}-${language === 'sv' ? 'SE' : language.toUpperCase()}`, serviceWorkers:'block' });
      await context.addInitScript(() => {
        localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion:'privacy-v2026.07.13', termsVersion:'terms-v2026.07.13', acceptedAt:new Date().toISOString() }));
        localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
        localStorage.removeItem('agm.profile.settings');
        localStorage.setItem('agm.profile.preferredLanguage', 'ro');
        sessionStorage.clear();
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => runtimeErrors.push({ language, viewport:viewportName, message:error.message }));
      await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const now = new Date().toISOString();
        let data = {};
        if (url.pathname.endsWith('/auth/refresh')) {
          await route.fulfill({ status:401, contentType:'application/json', body:JSON.stringify({ message:'No controlled session to restore' }) });
          return;
        } else if (url.pathname.endsWith('/auth/login')) {
          data = { accessToken:'controlled-final-language-token', user:{ id:'i18n-audit', displayName:'I18n Audit', email:'audit@example.test', roles:['PREMIUM_ACCESS'] } };
        } else if (url.pathname.endsWith('/auth/entitlements')) {
          data = { subjectId:'i18n-audit', tier:'premium', status:'active', capabilities:['premium.command-center','premium.voice-assistant','car-mover.jobs'], evaluatedAt:now, policyVersion:'access-entitlements@1.0.0' };
        } else if (url.pathname.endsWith('/authority-control-plane/dashboard')) {
          data = { contractVersion:'premium-agent-network.v1', controlPlane:{ status:'PASS', activeExecutiveAuthorities:1, conflicts:[] }, nodes:[], departments:[], opportunityIntelligence:{ gate:'GO', reason:'Controlled i18n validation' } };
        } else if (url.pathname.endsWith('/car-mover/jobs')) {
          data = [];
        } else if (url.pathname.endsWith('/communications/providers/status')) {
          data = [];
        }
        await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ data, requestId:'controlled-final-language-wave' }) });
      });

      await page.goto(new URL('/profile', target).toString(), { waitUntil:'domcontentloaded' });
      await page.waitForSelector('select[data-language-more="profilePreferredLanguage"]');
      await page.locator('select[data-language-more="profilePreferredLanguage"]').selectOption(language);
      await page.waitForTimeout(250);
      const selectorState = await page.evaluate(() => ({
        lang:document.documentElement.lang,
        preferredLanguage:sessionStorage.getItem('agm.profile.preferredLanguage'),
        profile:sessionStorage.getItem('agm.profile.settings'),
      }));
      if (selectorState.lang !== language || selectorState.preferredLanguage !== language) {
        throw new Error(`${language}/${viewportName}: language selector did not persist: ${JSON.stringify(selectorState)}`);
      }
      await expectText(page, 'body', expected.profile, `${language}/${viewportName}: profile language selector`);
      if (!(await page.locator(`[data-quick-language="${language}"]`).count())) throw new Error(`${language}/${viewportName}: selected language did not enter quick selector`);

      await navigate(page, '/basic', '.basic-hub');
      await assertSurface(page, language, viewportName, 'basic', expected.basic, evidenceDir);

      await navigate(page, '/access', '[data-access-enforcement]');
      await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'basic');
      await expectText(page, 'body', expected.access, `${language}/${viewportName}: localized access view`);
      await page.locator('input[name=email]').fill('audit@example.test');
      await page.locator('input[name=password]').fill('controlled-non-secret');
      await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
      await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
      await expectText(page, '[data-access-status]', expected.accessReady, `${language}/${viewportName}: localized Premium state`);

      await navigate(page, '/premium', '.premium-governance-view');
      await assertSurface(page, language, viewportName, 'premium', expected.premium, evidenceDir);

      await navigate(page, '/car-mover', '.car-mover-entry');
      await assertSurface(page, language, viewportName, 'car-mover', expected.carMover, evidenceDir);
      await context.close();
    }
  }
  if (runtimeErrors.length) throw new Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  report.targetPageStatus = 'PASS';
  report.probe = 'IT/ES/SV selector -> Basic -> localized Premium access state -> Premium -> Car Mover; desktop 1440x1000 and mobile 412x915; 18 captures; no horizontal overflow';
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await browser?.close();
  await viteServer?.close();
  report.status = fatal ? 'FAIL' : 'PASS';
  report.fatal = fatal;
  report.runtimeErrors = runtimeErrors;
  report.finishedAt = new Date().toISOString();
  report.revision = spawnSync('git',['rev-parse','HEAD'],{ cwd:root, encoding:'utf8' }).stdout.trim();
  report.workingTree = spawnSync('git',['status','--short'],{ cwd:root, encoding:'utf8' }).stdout.trim().split(/\r?\n/).filter(Boolean);
  await writeFile(path.join(evidenceDir,'report.json'), `${JSON.stringify(report,null,2)}\n`, 'utf8');
}
console.log(`FINAL LANGUAGE WAVE BROWSER: ${report.status}`);
console.log(path.join(evidenceDir,'report.json'));
if (fatal) { console.error(fatal); process.exitCode = 1; }

async function navigate(page, route, selector) {
  await page.evaluate((value) => { history.pushState({},'',value); dispatchEvent(new PopStateEvent('popstate')); }, route);
  await page.waitForURL((url) => url.pathname === route);
  await page.waitForSelector(selector);
}

async function expectText(page, selector, expected, label) {
  const text = await page.locator(selector).innerText();
  if (!text.toLocaleLowerCase().includes(expected.toLocaleLowerCase())) throw new Error(`${label}: expected ${JSON.stringify(expected)} in ${JSON.stringify(text.slice(0,800))}`);
}

async function assertSurface(page, language, viewport, surface, expected, out) {
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`${language}/${viewport}/${surface}: horizontal overflow`);
  await expectText(page, 'body', expected, `${language}/${viewport}/${surface}: localized marker`);
  if ((await page.locator('body').innerText()).includes('translation.missing')) throw new Error(`${language}/${viewport}/${surface}: raw missing translation marker`);
  const screenshot = path.join(out, `${language}-${viewport}-${surface}.png`);
  await page.screenshot({ path:screenshot, fullPage:true });
  results.push({ id:`${language}-${viewport}-${surface}`, status:'PASS', language, viewport, surface, screenshot:path.relative(root,screenshot), marker:expected });
}

async function httpReady(url) {
  for (let attempt=0; attempt<80; attempt+=1) {
    try { if ((await fetch(url)).status === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve,250));
  }
  throw new Error(`Target did not become HTTP 200: ${url}`);
}
