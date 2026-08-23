import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'car-mover', 'p0-02', 'android', runId);
await mkdir(out, { recursive: true });
let browser;
let fatal = null;
const results = [];

try {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  if (!targets.some((item) => item.type === 'page' && !item.url.includes('sw.js'))) throw Error('Android WebView unavailable');
  browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts().flatMap((context) => context.pages()).find((item) => !item.url().includes('sw.js'));
  if (!page) throw Error('Android page unavailable');
  if (new URL(page.url()).origin !== 'https://localhost') throw Error(`Android origin isolation mismatch: ${new URL(page.url()).origin}`);

  await page.evaluate(() => { history.pushState({}, '', '/access'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForSelector('[data-access-enforcement]');
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') !== 'checking');
  const accessState = await page.locator('[data-access-enforcement]').getAttribute('data-access-state');
  if (accessState !== 'premium') throw Error(`Real Premium session required: ${accessState}`);

  await page.evaluate(() => { history.pushState({}, '', '/car-mover'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForSelector('[data-car-mover-root]');
  const vehicleClasses = await page.locator('select[name=vehicleClass] option').evaluateAll((options) => options.map((option) => option.value));
  if (vehicleClasses.filter(Boolean).length !== 6) throw Error('Six vehicle classes were not rendered.');

  const e2e = await page.evaluate(async (executionId) => {
    const token = sessionStorage.getItem('agm.auth.accessToken');
    if (!token) throw Error('Authenticated Android session token missing.');
    const apiBase = 'https://api.agmcockpit.com/api/v1';
    const call = async (route, init = {}) => {
      const response = await fetch(`${apiBase}${route}`, { ...init, headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json', ...(init.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(`${route}: ${body.message || response.status}`);
      return body.data;
    };
    const entitlement = await call('/auth/entitlements');
    if (!entitlement.capabilities.includes('car-mover.jobs')) throw Error('car-mover.jobs missing from Premium entitlement.');
    const created = await call('/car-mover/jobs', { method:'POST', body:JSON.stringify({ vehicle:{ vehicleClass:'PASSENGER_CAR', vehicleType:'production-e2e', make:'AGM', model:'Car Mover E2E', registration:`E2E-${executionId.slice(-8)}` }, pickup:{ label:'AGM Production E2E Start' }, destination:{ label:'AGM Production E2E Finish' }, sourceReference:`android-e2e-${executionId}` }) });
    const transition = (toState, extra = {}) => call(`/car-mover/jobs/${created.jobId}/transitions`, { method:'POST', body:JSON.stringify({ toState, ...extra }) });
    const protocol = (protocolType, odometerKm) => call(`/car-mover/jobs/${created.jobId}/protocols`, { method:'POST', body:JSON.stringify({ protocolType, odometerKm, energyPercent:80, keyCount:2, conditionNotes:`${protocolType} verified by Android Production E2E`, photoDigests:[`sha256:${executionId}:${protocolType}`] }) });
    await transition('READY');
    await transition('ASSIGNED', { assignedDriverUserId:entitlement.subjectId });
    await transition('ACCEPTED');
    await protocol('TAKEOVER', 1000);
    await transition('IN_PROGRESS');
    await transition('ARRIVED');
    await transition('HANDOVER_PENDING');
    await protocol('HANDOVER', 1042);
    await transition('COMPLETED');
    const file = await call(`/car-mover/jobs/${created.jobId}`);
    return { jobId:created.jobId, state:file.job.currentState, timelineTypes:file.timeline.map((event) => event.eventType), auditReferenceCount:file.auditReferences.length, evidenceReferenceCount:file.evidenceReferences.length, entitlementPolicy:entitlement.policyVersion };
  }, runId);

  const expected = ['CAR_MOVER_JOB_CREATED','CAR_MOVER_JOB_STATE_CHANGED','CAR_MOVER_JOB_STATE_CHANGED','CAR_MOVER_JOB_STATE_CHANGED','CAR_MOVER_TAKEOVER_RECORDED','CAR_MOVER_JOB_STATE_CHANGED','CAR_MOVER_JOB_STATE_CHANGED','CAR_MOVER_JOB_STATE_CHANGED','CAR_MOVER_HANDOVER_RECORDED','CAR_MOVER_JOB_STATE_CHANGED'];
  if (e2e.state !== 'COMPLETED' || JSON.stringify(e2e.timelineTypes) !== JSON.stringify(expected) || e2e.auditReferenceCount !== 10) throw Error('Production lifecycle/EventStore/audit verification failed.');

  await page.evaluate(() => { history.pushState({}, '', '/car-mover'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForSelector(`[data-job="${e2e.jobId}"]`);
  await page.locator(`[data-job="${e2e.jobId}"]`).click();
  await page.waitForSelector('[data-car-mover-dialog][open]');
  const screenshot = path.join(out, 'android-car-mover-production-e2e.png');
  await page.screenshot({ path:screenshot, fullPage:true });
  const viewport = await page.evaluate(() => ({ width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth }));
  if (viewport.scrollWidth > viewport.width + 1) throw Error('Android horizontal overflow.');
  results.push({ id:'android-production-premium-lifecycle-takeover-handover', status:'PASS', origin:'https://localhost', route:'/car-mover', vehicleClasses, viewport, ...e2e, screenshot:path.relative(root, screenshot) });
} catch (error) {
  fatal = String(error);
} finally {
  await browser?.close();
  const apk = path.join(root, 'apps', 'web', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const apkSha256 = createHash('sha256').update(readFileSync(apk)).digest('hex').toUpperCase();
  const report = { schemaVersion:2, runId, status:fatal ? 'FAIL' : 'PASS', device:'Samsung SM-S931B', package:'com.agm.cockpit', apkSha256, apiMode:'authenticated Production API', results, fatal };
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`CAR MOVER P0-02 ANDROID PRODUCTION: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (fatal) process.exitCode = 1;
}
