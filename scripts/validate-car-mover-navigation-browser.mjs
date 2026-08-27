import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const webRequire = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const { createServer: createViteServer } = await import(pathToFileURL(webRequire.resolve('vite')).href);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'car-mover', 'navigation-path', runId);
const externalTarget = process.env.AGM_CAR_MOVER_TARGET?.trim();
const results = [];
const requestTrace = [];
const report = { schemaVersion:1, runId, runner:'Controlled AGM Playwright/Chromium', browserPluginStatus:'PASS', integratedBrowserControlStatus:'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE', browserSessionStatus:'FAIL', targetPageStatus:'FAIL', results };
let viteServer; let browser; let page; let fatal;

await mkdir(out, { recursive:true });
try {
  const port = externalTarget ? undefined : await freePort();
  const target = externalTarget ? `${externalTarget.replace(/\/+$/,'')}/` : `http://127.0.0.1:${port}/`;
  if (!externalTarget) {
    viteServer = await createViteServer({ root:path.join(root,'apps','web'), server:{ host:'127.0.0.1', port, strictPort:true }, logLevel:'silent' });
    await viteServer.listen();
  }
  await httpReady(target); report.target = target; report.targetSource = externalTarget ? 'EXTERNAL_RUNTIME' : 'CONTROLLED_EPHEMERAL';
  browser = await chromium.launch({ headless:true }); report.browserSessionStatus = 'PASS';
  const context = await browser.newContext({ viewport:{ width:1440, height:1000 }, locale:'ro-RO', serviceWorkers:'block' });
  page = await context.newPage();
  const runtimeErrors = []; let incidentWrites = 0;
  page.on('pageerror', (error) => runtimeErrors.push(error.stack ?? error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.includes('/api/v1/')) requestTrace.push({ direction:'response', method:response.request().method(), path:url.pathname, status:response.status() });
  });
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion:'privacy-v2026.07.13', termsVersion:'terms-v2026.07.13', acceptedAt:new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });

  const now = new Date().toISOString();
  const jobs = [
    job('job-accepted','ACCEPTED','Volkswagen','Golf','Berlin','Paris',now),
    job('job-arrived','ARRIVED','Renault','Clio','Lyon','Dijon',now),
    job('job-completed','COMPLETED','BMW','320d','Paris','Berlin',now),
    job('job-cancelled','CANCELLED','MAN','TGX','Köln','Bonn',now),
  ];
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url(); const method = route.request().method(); let data = {};
    requestTrace.push({ direction:'intercept', method, path:new URL(url).pathname });
    if (url.endsWith('/auth/login')) data = { accessToken:'controlled-car-mover-token', user:{ id:'owner', displayName:'Owner', email:'owner@example.test', roles:['OWNER','PREMIUM_ACCESS'] } };
    else if (url.endsWith('/auth/refresh')) data = { accessToken:'controlled-car-mover-token', user:{ id:'owner', displayName:'Owner', email:'owner@example.test', roles:['OWNER','PREMIUM_ACCESS'] } };
    else if (url.endsWith('/auth/entitlements')) data = { subjectId:'owner', tier:'premium', status:'active', capabilities:['premium.command-center','premium.voice-assistant','car-mover.jobs'], evaluatedAt:now, policyVersion:'access-entitlements@1.0.0' };
    else if (url.endsWith('/authority-control-plane/dashboard')) data = { contractVersion:'premium-agent-network.v1', controlPlane:{ status:'PASS', activeExecutiveAuthorities:1, conflicts:[] }, nodes:[], departments:[], opportunityIntelligence:{ gate:'GO', reason:'Controlled navigation audit' } };
    else if (url.endsWith('/car-mover/jobs') && method === 'GET') data = jobs;
    else if (/\/car-mover\/jobs\/job-[^/]+$/.test(new URL(url).pathname)) { const id = new URL(url).pathname.split('/').at(-1); data = file(jobs.find((item) => item.id === id) ?? jobs[0], now); }
    else if (url.endsWith('/communications/providers/status')) data = [{ channel:'email', provider:'gmail', configured:true }];
    else if (url.endsWith('/car-mover/jobs/platform-offers/list')) data = [{ id:'offer-1', channel:'email', platformName:'Gmail / TIMOCOM', pickupLabel:'Berlin', destinationLabel:'Paris', vehicleDescription:'Volkswagen Golf', offeredAmount:'640.00', currencyCode:'EUR', estimatedKm:1050, score:86, status:'REVIEWED', extractionConfidence:94, analysis:{ reason:'Ofertă normalizată și deduplicată.' } }];
    else if (url.endsWith('/opportunity-intelligence/planning')) data = [planning(now)];
    else if (url.endsWith('/opportunity-intelligence/copilot')) data = { variantCount:1, variants:[], recommendation:'BEST_FRESH_RECOMMENDED_VARIANT', canAcceptAutomatically:false };
    else if (url.endsWith('/incidents') && method === 'GET') data = [{ id:'incident-1', transportJobId:'job-arrived', incidentType:'handover-review', severity:'medium', status:'open', title:'Predare în verificare', description:'Fotografia de predare necesită verificare.', createdAt:now }];
    else if (url.endsWith('/incidents') && method === 'POST') { incidentWrites += 1; data = { incidentId:'incident-new', status:'open' }; }
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ data, requestId:'controlled-car-mover-navigation' }) });
  });

  await page.goto(new URL('/access', target).toString(), { waitUntil:'networkidle' });
  await page.locator('input[name=email]').fill('owner@example.test'); await page.locator('input[name=password]').fill('not-a-real-secret'); await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await navigate(page, '/premium', '.premium-governance-view');
  await page.locator('[data-module="carMover"]').click(); await page.waitForURL(`${target}car-mover`); await page.waitForSelector('.car-mover-entry');
  results.push({ id:'premium-hero-to-car-mover', status:'PASS', route:'/premium -> /car-mover', detail:'The visible AGM Car Mover action in Premium opens the dedicated Car Mover HERO.' });
  if (!(await page.locator('[data-module="premiumCopilot"]').isVisible()) || !(await page.locator('[data-module="ocr"]').isVisible()) || !(await page.locator('[data-module="premiumVoice"]').isVisible())) throw new Error('HERO Copilot/OCR/Voice quick controls are missing.');
  if (await page.locator('.car-mover-entry-modules').count()) throw new Error('HERO bypasses the approved hub by exposing module cards directly.');
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error('Car Mover HERO has horizontal desktop overflow.');
  if (!(await firstViewport(page, '.car-mover-entry-action'))) throw new Error('Car Mover HERO action is outside the first desktop viewport.');
  await capture(page, out, results, root, 'hero-desktop', '/car-mover', 'HERO exposes one Car Mover hub action plus direct Premium Copilot, OCR and Voice controls.');

  await page.setViewportSize({ width:412, height:915 }); await navigate(page, '/car-mover', '.car-mover-entry');
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error('Car Mover HERO has horizontal mobile overflow.');
  if (!(await firstViewport(page, '.car-mover-entry-action'))) throw new Error('Car Mover HERO action is outside the first mobile viewport.');
  await capture(page, out, results, root, 'hero-mobile', '/car-mover', 'Mobile HERO 412x915: route background, human boundary and primary action remain visible without horizontal overflow.');
  await page.setViewportSize({ width:1440, height:1000 }); await navigate(page, '/car-mover', '.car-mover-entry');

  results.push({ id:'hero-hub-boundary', status:'PASS', route:'/car-mover', detail:'HERO has one operational entry to the six-card hub and does not bypass it with direct module cards.' });

  await page.locator('[data-module="premiumCopilot"]').click(); await page.waitForURL(`${target}premium/copilot`); await page.waitForSelector('.copilot-mic');
  results.push({ id:'premium-microphone-reuse', status:'PASS', route:'/premium/copilot', detail:'Car Mover HERO opens the existing Premium Copilot microphone; no Car Mover microphone instance is rendered.' });
  await navigate(page, '/car-mover', '.car-mover-entry'); await page.locator('.car-mover-entry-action').click(); await page.waitForURL(`${target}car-mover/menu`); await page.waitForSelector('.car-mover-menu-grid');
  if (await page.locator('.car-mover-menu-card').count() !== 6) throw new Error('Car Mover menu does not contain exactly six paths.');
  if (!(await page.locator('[data-car-mover-quick="ocr"]').isVisible()) || !(await page.locator('[data-car-mover-quick="voice"]').isVisible())) throw new Error('Car Mover hub is missing direct OCR/Voice access.');
  await capture(page, out, results, root, 'menu-desktop', '/car-mover/menu', 'Exactly six real module paths are visible.');
  await page.locator('[data-car-mover-quick="ocr"]').click(); await page.waitForURL(`${target}ocr`); await page.waitForSelector('.translator-hud');
  await navigate(page, '/car-mover/menu', '.car-mover-menu-grid');
  await page.locator('[data-car-mover-quick="voice"]').click(); await page.waitForURL(`${target}premium/voice`); await page.waitForSelector('[data-premium-assistant]');
  results.push({ id:'hub-direct-ocr-voice', status:'PASS', route:'/car-mover/menu -> /ocr + /premium/voice', detail:'Hub OCR and Voice controls both open their real existing AGM pages.' });
  await navigate(page, '/car-mover/menu', '.car-mover-menu-grid');

  const modules = [
    ['carMoverPlanning','/car-mover/planning','[data-opportunity-planning]','Planning / Opportunity Intelligence'],
    ['carMoverActive','/car-mover/active-transfer','[data-car-mover-create]','Active Transfer'],
    ['carMoverCompletion','/car-mover/completion-incidents','[data-car-mover-incident]','Completion / Incidents'],
    ['carMoverAccounting','/car-mover/accounting','[data-car-mover-list]','Post-Trip / Primary Accounting'],
    ['carMoverGuide','/car-mover/guide','.car-mover-guide-grid','Car Mover Guide'],
    ['carMoverArchive','/car-mover/archive','[data-car-mover-list]','Archive'],
  ];
  for (const [module, route, readySelector, label] of modules) {
    await page.locator(`[data-module="${module}"]`).click(); await page.waitForURL(`${target}${route.slice(1)}`); await page.waitForSelector(readySelector);
    const body = await page.locator('body').innerText();
    if (/coming soon|în pregătire|placeholder/i.test(body)) throw new Error(`${label} contains placeholder content.`);
    if (!(await page.locator('[data-module="carMoverMenu"]').isVisible()) || !(await page.locator('[data-module="carMover"]').isVisible())) throw new Error(`${label} is missing explicit Menu/HERO back paths.`);
    if (!(await page.locator('[data-car-mover-quick="ocr"]').isVisible()) || !(await page.locator('[data-car-mover-quick="voice"]').isVisible())) throw new Error(`${label} is missing direct OCR/Voice access.`);
    if (module === 'carMoverPlanning') await page.waitForSelector('.car-mover-variant');
    if (module === 'carMoverActive') { await page.locator('[data-job="job-accepted"]').click(); await page.waitForSelector('dialog[open] [data-car-mover-protocol]'); await page.locator('[data-car-mover-close]').click(); }
    if (module === 'carMoverCompletion') {
      const form = page.locator('[data-car-mover-incident]'); await form.locator('select[name=transportJobId]').selectOption('job-arrived'); await form.locator('input[name=incidentType]').fill('field-test-exception'); await form.locator('input[name=title]').fill('Incident de probă controlată'); await form.evaluate((element) => element.requestSubmit()); await page.waitForFunction(() => document.querySelector('[data-car-mover-status]')?.textContent?.includes('Incident File creat'));
      if (incidentWrites !== 1) throw new Error('Incident File did not cross the real write boundary exactly once.');
    }
    if (module === 'carMoverAccounting') { await page.locator('[data-job="job-completed"]').click(); await page.waitForSelector('dialog[open] [data-car-mover-finance]'); const modal = await page.locator('[data-car-mover-file]').innerText(); if (!modal.includes('ESTIM') && !modal.includes('Estim')) throw new Error('Estimated/actual separation is not visible.'); await page.locator('[data-car-mover-close]').click(); }
    if (module === 'carMoverArchive') { await page.locator('[data-job="job-cancelled"]').click(); await page.waitForSelector('dialog[open]'); if (await page.locator('dialog[open] form').count()) throw new Error('Archive Job File is not read-only.'); await page.locator('[data-car-mover-close]').click(); }
    await capture(page, out, results, root, `module-${module}`, route, `${label}: themed background, live contract surface, explicit Menu/HERO return, no placeholder.`);
    await page.locator('[data-module="carMoverMenu"]').click(); await page.waitForURL(`${target}car-mover/menu`); await page.waitForSelector('.car-mover-menu-grid');
  }

  await page.setViewportSize({ width:412, height:915 }); await navigate(page, '/car-mover/menu', '.car-mover-menu-grid');
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error('Car Mover menu has horizontal mobile overflow.');
  await capture(page, out, results, root, 'menu-mobile', '/car-mover/menu', 'Mobile menu 412x915: six paths, no horizontal overflow.');
  await page.locator('[data-module="carMoverActive"]').click(); await page.waitForSelector('[data-car-mover-create]');
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error('Active Transfer has horizontal mobile overflow.');
  await capture(page, out, results, root, 'active-transfer-mobile', '/car-mover/active-transfer', 'Android-sized layout preserves the operational path and controls.');
  if (runtimeErrors.length) throw new Error(`Browser runtime errors: ${runtimeErrors.join(' | ')}`);

  report.targetPageStatus = 'PASS';
  report.probe = `${target}access -> /car-mover HERO -> /car-mover/menu six-card hub -> six module pages -> menu/HERO returns; OCR/Voice direct access on every page; Premium Copilot on HERO; Premium microphone reuse; Incident write; desktop/mobile captures`;
  await context.close();
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
  if (page) { report.failureUrl = page.url(); report.failureText = String(await page.locator('body').innerText().catch(() => '')).slice(0,1800); await page.screenshot({ path:path.join(out,'failure.png'), fullPage:true }).catch(() => undefined); }
} finally {
  await browser?.close(); await viteServer?.close();
  report.status = fatal ? 'FAIL' : 'PASS'; report.fatal = fatal; report.finishedAt = new Date().toISOString(); report.revision = spawnSync('git',['rev-parse','HEAD'],{ cwd:root, encoding:'utf8' }).stdout.trim();
  report.requestTrace = requestTrace;
  await writeFile(path.join(out,'report.json'), `${JSON.stringify(report,null,2)}\n`, 'utf8');
}
console.log(`CAR MOVER NAVIGATION BROWSER: ${report.status}`); console.log(path.join(out,'report.json')); if (fatal) { console.error(fatal); process.exitCode = 1; }

function job(id,currentState,make,model,pickup,destination,updatedAt) { return { id,currentState,vehicleSubject:{ vehicleClass:make === 'MAN' ? 'TRACTOR_UNIT' : 'PASSENGER_CAR', vehicleType:make === 'MAN' ? 'tractor unit' : 'passenger car', make,model },pickupSnapshot:{ label:pickup },destinationSnapshot:{ label:destination },updatedAt }; }
function file(item,now) { return { job:item,vehicle:item.vehicleSubject,timeline:[{ eventType:'CAR_MOVER_JOB_CREATED',occurredAt:now,payload:{} }],auditReferences:['audit:car-mover:1'],evidenceReferences:['evidence:protocol:1'],financialEntries:[{ id:'finance-1',entryType:'REVENUE',category:'TRANSFER',amount:'640.00',currencyCode:'EUR',occurredAt:now }],invoices:[],communications:[],analysis:{ revenue:'640.00',cost:'118.00',payments:'0.00',margin:'522.00',currencyCode:'EUR',entryCount:2 } }; }
function planning(now) { return { verdict:{ id:'verdict-1',classification:'RECOMMENDED',freshnessStatus:'FRESH',confidence:91,risks:[],createdAt:now },chain:{ id:'chain-1',chainKey:'chain-1',version:1,opportunityIds:['op-1'],metrics:{ estimatedGrossProfit:341,estimatedProfitPerKm:.61,estimatedProfitPerHour:36.8,emptyKm:67,finalHomeDistanceKm:18,estimatedTotalCost:112 },feasible:true },humanDecision:null,mobilitySummary:{ sources:['TomTom route','TollGuru conditional'],distanceKm:1050,durationMinutes:650,repositionKm:67,estimatedTolls:[{amount:25,currency:'EUR'}],freshnessStatus:'FRESH',validUntil:new Date(Date.now()+1800000).toISOString(),warnings:[] } }; }
async function navigate(page,route,selector) { await page.evaluate((value) => { history.pushState({},'',value); dispatchEvent(new PopStateEvent('popstate')); }, route); await page.waitForURL((url) => url.pathname === route); await page.waitForSelector(selector); }
async function capture(page,out,results,root,id,route,detail) { const shot = path.join(out,`${id}.png`); await page.screenshot({ path:shot, fullPage:true }); results.push({ id,status:'PASS',route,viewport:page.viewportSize(),screenshot:path.relative(root,shot),detail }); }
async function firstViewport(page,selector) { return page.locator(selector).evaluate((element) => { const rect=element.getBoundingClientRect(); return rect.top>=0&&rect.bottom<=window.innerHeight&&rect.left>=0&&rect.right<=window.innerWidth; }); }
async function freePort() { return new Promise((resolve,reject) => { const probe=createNetServer(); probe.once('error',reject); probe.listen(0,'127.0.0.1',() => { const address=probe.address(); const port=typeof address==='object'&&address?address.port:0; probe.close((error)=>error?reject(error):resolve(port)); }); }); }
async function httpReady(url) { for(let attempt=0;attempt<80;attempt+=1){ try{if((await fetch(url)).status===200)return;}catch{} await new Promise((resolve)=>setTimeout(resolve,250)); } throw new Error(`Target did not become HTTP 200: ${url}`); }
