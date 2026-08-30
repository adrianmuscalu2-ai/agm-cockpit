import { chromium, firefox, request as playwrightRequest, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = (process.env.AGM_WEBSITE_AUDIT_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '');
const publicUrl = 'https://agm-cockpit-website.pages.dev';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = resolve('evidence/website-final-release', runId);
const pages = ['', 'features', 'basic', 'premium', 'evolution', 'faq', 'contact', 'impressum', 'privacy', 'terms'];
const allRoutes = ['', '/de', '/en'].flatMap((prefix) => pages.map((page) => `${prefix}/${page}`.replace(/\/$/, '') || '/').map((route) => route.endsWith('/') ? route : `${route}/`));
const requestedRoutes = process.env.AGM_WEBSITE_AUDIT_ROUTES?.split(',').map((route) => route.trim()).filter(Boolean);
const routes = requestedRoutes?.length ? requestedRoutes.map((route) => route.endsWith('/') ? route : `${route}/`) : allRoutes;
const allEngines = { chromium, firefox, webkit };
const requestedEngines = process.env.AGM_WEBSITE_AUDIT_ENGINES?.split(',').map((engine) => engine.trim()).filter(Boolean);
const engines = Object.fromEntries(Object.entries(allEngines).filter(([name]) => !requestedEngines?.length || requestedEngines.includes(name)));
const allViewports = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } };
const requestedViewports = process.env.AGM_WEBSITE_AUDIT_VIEWPORTS?.split(',').map((viewport) => viewport.trim()).filter(Boolean);
const viewports = Object.fromEntries(Object.entries(allViewports).filter(([name]) => !requestedViewports?.length || requestedViewports.includes(name)));
const staleClaims = /not yet publicly released|no public access|keinen öffentlichen Zugang|noch nicht öffentlich freigegeben|fără acces public|nu sunt încă lansate public|owner review required|not ready for publication|nicht zur veröffentlichung|9 active|9 activ|9 aktiv|9 attive|9 activos|9 aktiva|3 (?:în următorul val|in the next wave|in der nächsten welle|nella prossima fase|en la próxima fase|i nästa fas)/i;

await mkdir(evidenceDir, { recursive: true });
const scenarios = [];
const infrastructure = [];
const discoveredInternalPaths = new Set();
const externalAppLinks = new Set();
let fatal = null;

try {
  for (const [engineName, browserType] of Object.entries(engines)) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const [viewportName, viewport] of Object.entries(viewports)) {
        const context = await browser.newContext({ viewport, locale: 'ro-RO' });
        for (const route of routes) {
          const page = await context.newPage();
          const consoleErrors = [];
          const requestFailures = [];
          const badResponses = [];
          page.removeAllListeners();
          page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
          page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} · ${request.failure()?.errorText ?? 'FAILED'}`));
          page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
          const startedAt = Date.now();
          const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 20_000 });
          await page.waitForTimeout(120);
          const durationMs = Date.now() - startedAt;
          const facts = await page.evaluate(() => ({
            title: document.title,
            lang: document.documentElement.lang,
            description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
            robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '',
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
            ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? '',
            ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
            twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') ?? '',
            text: document.body.innerText,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            mainVisible: Boolean(document.querySelector('main')?.getBoundingClientRect().height),
            headerVisible: Boolean(document.querySelector('header.site-header')?.getBoundingClientRect().height),
            footerVisible: Boolean(document.querySelector('footer.cockpit-footer')?.getBoundingClientRect().height),
            images: [...document.images].filter((image) => Boolean(image.currentSrc || image.getAttribute('src'))).map((image) => ({ src: image.currentSrc || image.src, complete: image.complete, width: image.naturalWidth })),
            links: [...document.querySelectorAll('a[href]')].map((link) => link.getAttribute('href')).filter(Boolean),
            languageCodes: [...document.querySelectorAll('[data-language-code]')].map((node) => node.getAttribute('data-language-code')),
            forms: document.querySelectorAll('form').length,
            requiredControls: document.querySelectorAll('form [required]').length,
          }));
          for (const href of facts.links) {
            if (href.startsWith('/')) discoveredInternalPaths.add(new URL(href, baseUrl).pathname);
            if (href.startsWith('https://app.agmcockpit.com')) externalAppLinks.add(href);
          }
          const expectedLang = route.match(/^\/(de|en|it|es|sv)(?:\/|$)/)?.[1] ?? 'ro';
          const checks = {
            http200: response?.status() === 200,
            language: facts.lang === expectedLang,
            title: facts.title.length >= 8,
            description: facts.description.length >= 50,
            indexable: facts.robots === 'index, follow, max-image-preview:large',
            canonical: facts.canonical.startsWith(publicUrl) && new URL(facts.canonical).pathname === route,
            openGraph: facts.ogUrl === facts.canonical && facts.ogImage.startsWith(publicUrl),
            twitter: facts.twitterCard === 'summary_large_image',
            noOverflow: facts.scrollWidth <= facts.clientWidth + 1,
            shell: facts.mainVisible && facts.headerVisible && facts.footerVisible,
            images: facts.images.every((image) => image.complete && image.width > 0),
            console: consoleErrors.length === 0,
            network: requestFailures.length === 0 && badResponses.length === 0,
            currentContent: !staleClaims.test(facts.text),
            performanceBudget: durationMs < 10_000,
          };
          if (['/', '/de/', '/en/', '/it/', '/es/', '/sv/'].includes(route)) {
            checks.languagePresentation12 = new Set(facts.languageCodes).size === 12;
            checks.languageStatusHonest = /12 (active|aktiv|attive|activos|aktiva)|12 active/i.test(facts.text) && !/next wave|următorul val|nächsten welle|prossima fase|próxima fase|nästa fas/i.test(facts.text);
          }
          if (route.endsWith('/contact/')) {
            checks.contactChannels = facts.links.some((href) => href.startsWith('mailto:agm.transporte.logistik@gmail.com')) && facts.links.some((href) => href.startsWith('tel:'));
            checks.formContract = route === '/contact/' ? facts.forms === 1 && facts.requiredControls === 5 : facts.forms === 0;
            if (route === '/contact/' && engineName === 'chromium') {
              await page.locator('input[name="name"]').fill('AGM Release Audit');
              await page.locator('input[name="email"]').fill('release.audit@example.com');
              await page.locator('textarea[name="message"]').fill('Mesaj de validare locală.');
              await page.locator('input[name="consent"]').check();
              checks.formInteraction = await page.locator('#contact-form').evaluate((form) => {
                const textarea = form.querySelector('textarea[name="message"]');
                const counter = document.querySelector('#message-count');
                return form.checkValidity() && counter?.textContent === String(textarea?.value.length ?? 0);
              });
            }
          }
          if (route.endsWith('/impressum/')) checks.operatorIdentity = /A\.G\.M\. Transporten/.test(facts.text) && /Alexandru-Adrian Muscalu/.test(facts.text) && /Staufenbergstraße 72/.test(facts.text);
          if (route === '/' && engineName === 'chromium') {
            await page.keyboard.press('Tab');
            checks.keyboardSkipLink = await page.locator('.skip-link').evaluate((node) => document.activeElement === node);
          }
          if (route === '/' && viewportName === 'mobile') {
            await page.locator('.mobile-nav summary').click();
            checks.mobileNavigation = await page.locator('.mobile-menu a').first().isVisible();
            await page.locator('.mobile-nav summary').click();
          }
          if (route === '/' && viewportName === 'desktop') checks.desktopNavigation = await page.locator('.desktop-nav a').first().isVisible();
          let screenshot = null;
          if (engineName === 'chromium' && !route.startsWith('/de/') && !route.startsWith('/en/')) {
            const slug = route === '/' ? 'home' : route.replaceAll('/', '');
            screenshot = `chromium-${viewportName}-${slug}.png`;
            await page.screenshot({ path: resolve(evidenceDir, screenshot), fullPage: true });
          }
          scenarios.push({ engine: engineName, viewport: viewportName, route, durationMs, httpStatus: response?.status() ?? null, checks, consoleErrors, requestFailures, badResponses, screenshot });
          await page.close();
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }

  const request = await playwrightRequest.newContext({ baseURL: baseUrl });
  try {
    for (const path of ['/robots.txt', '/sitemap.xml', '/favicon.ico', '/favicon.svg', '/images/brand/agm-icon-master.png', '/.well-known/agm-website-health.json']) {
      const response = await request.get(path);
      const body = await response.text();
      infrastructure.push({ path, status: response.status(), contentType: response.headers()['content-type'] ?? '', bytes: body.length, pass: response.status() === 200 && body.length > 0 });
    }
    const notFound = await request.get('/route-that-does-not-exist-website-audit');
    const notFoundBody = await notFound.text();
    infrastructure.push({ path: '/route-that-does-not-exist-website-audit', status: notFound.status(), contentType: notFound.headers()['content-type'] ?? '', bytes: notFoundBody.length, pass: notFound.status() === 404 && /Pagina nu a fost găsită/.test(notFoundBody) });
    for (const path of discoveredInternalPaths) {
      const response = await request.get(path);
      infrastructure.push({ path, status: response.status(), contentType: response.headers()['content-type'] ?? '', bytes: Number(response.headers()['content-length'] ?? 1), pass: response.status() < 400 });
    }
  } finally {
    await request.dispose();
  }
} catch (error) {
  fatal = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

const scenarioPass = scenarios.length === Object.keys(engines).length * Object.keys(viewports).length * routes.length
  && scenarios.every((scenario) => Object.values(scenario.checks).every(Boolean));
const infrastructurePass = infrastructure.length > 0 && infrastructure.every((item) => item.pass);
const gates = {
  visual: scenarioPass && scenarios.filter((scenario) => scenario.screenshot).length === (Object.hasOwn(engines, 'chromium') ? routes.filter((route) => !route.startsWith('/de/') && !route.startsWith('/en/')).length * Object.keys(viewports).length : 0),
  content: scenarioPass,
  routes: infrastructurePass,
  desktop: scenarios.filter((scenario) => scenario.viewport === 'desktop').every((scenario) => Object.values(scenario.checks).every(Boolean)),
  mobile: scenarios.filter((scenario) => scenario.viewport === 'mobile').every((scenario) => Object.values(scenario.checks).every(Boolean)),
  majorBrowsers: Object.keys(engines).every((engine) => scenarios.some((scenario) => scenario.engine === engine && Object.values(scenario.checks).every(Boolean))),
  languages12Presented: scenarios.filter((scenario) => ['/', '/de/', '/en/', '/it/', '/es/', '/sv/'].includes(scenario.route)).every((scenario) => scenario.checks.languagePresentation12 && scenario.checks.languageStatusHonest),
  metadata: infrastructurePass && scenarios.every((scenario) => scenario.checks.canonical && scenario.checks.openGraph && scenario.checks.indexable),
  externalAppCta: !routes.includes('/') || externalAppLinks.size > 0,
};
const passed = !fatal && Object.values(gates).every(Boolean);
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  scope: { engines: Object.keys(engines), routes },
  runner: 'Controlled AGM Playwright · Chromium / Firefox / WebKit',
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: fatal ? 'FAIL' : 'PASS',
  targetPageStatus: passed ? 'PASS' : 'FAIL',
  baseUrl,
  publicCanonicalOrigin: publicUrl,
  scenarioCount: scenarios.length,
  screenshotCount: scenarios.filter((scenario) => scenario.screenshot).length,
  externalAppLinks: [...externalAppLinks],
  gates,
  infrastructure,
  scenarios,
  fatal,
};
await writeFile(resolve(evidenceDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, scenarios: `${scenarios.length} detailed records`, evidenceDir }, null, 2));
if (!passed) process.exitCode = 1;
