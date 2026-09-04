import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const targetUrl = process.env.AGM_TURN_FUNCTIONAL_URL || 'https://app.agmcockpit.com/turn';
const apiUrl = process.env.AGM_TURN_FUNCTIONAL_API_URL || 'https://api.agmcockpit.com/api/v1/operations/turn/functional-overview';
const ownerAccessToken = process.env.AGM_TURN_OWNER_ACCESS_TOKEN?.trim();
const evidenceScope = targetUrl === 'https://app.agmcockpit.com/turn' && apiUrl === 'https://api.agmcockpit.com/api/v1/operations/turn/functional-overview'
  ? 'PRODUCTION_LIVE'
  : 'NON_PRODUCTION_LIVE';
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = resolve(process.env.AGM_TURN_FUNCTIONAL_EVIDENCE_DIR || `evidence/turn-functional-completeness/browser/${runStamp}`);
await mkdir(evidenceRoot, { recursive: true });

const report = {
  contract: 'turn-functional-overview-browser.v1',
  startedAt: new Date().toISOString(),
  targetUrl,
  apiUrl,
  evidenceScope,
  browser: 'AGM controlled Playwright/Chromium',
  realSourcePolicy: 'NO_ROUTE_STUBS_NO_MOCK_PAYLOAD_NO_STATUS_FALLBACK',
  ownerAccess: ownerAccessToken ? 'REAL_BEARER_TOKEN_PROVIDED_REDACTED' : 'MISSING',
  status: 'FAIL',
  productOwnerAcceptance: 'NOT_GRANTED',
  finalProductPass: false,
  browserFields: {
    browserPluginStatus: 'PENDING',
    integratedBrowserControlStatus: 'PENDING',
    browserSessionStatus: 'PENDING',
    targetPageStatus: 'PENDING',
  },
  checks: {},
  network: [],
  consoleErrors: [],
  pageErrors: [],
};

let browser;
try {
  assert(ownerAccessToken, 'AGM_TURN_OWNER_ACCESS_TOKEN is required; no authentication stub is permitted.');
  const preflight = JSON.parse(await readFile(resolve('tmp/rescue-browser-preflight.json'), 'utf8'));
  const preflightAgeMs = Date.now() - Date.parse(preflight.checkedAt);
  assert(Number.isFinite(preflightAgeMs) && preflightAgeMs <= 10 * 60_000, 'Browser preflight is missing or older than 10 minutes.');
  const pluginPass = preflight.runtime?.extensionVersions?.length > 0
    && preflight.runtime?.nodeRepl?.exists === true
    && preflight.runtime?.helper?.exists === true;
  assert(pluginPass, 'Browser plugin/runtime executable preflight is not PASS.');
  report.browserFields.browserPluginStatus = 'PASS';
  report.browserFields.integratedBrowserControlStatus = String(preflight.iab?.status).startsWith('PASS')
    ? 'PASS'
    : 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE';
  report.checks.preflight = {
    checkedAt: preflight.checkedAt,
    visualSignature: preflight.visualSignature,
    iab: preflight.iab,
    controlledRunner: preflight.controlledRunner,
  };

  const apiResponse = await fetch(apiUrl, {
    cache: 'no-store',
    headers: { Accept: 'application/json', Authorization: `Bearer ${ownerAccessToken}` },
  });
  const apiPayload = await apiResponse.json().catch(() => ({}));
  assert(apiResponse.status === 200, `Functional overview API HTTP ${apiResponse.status}`);
  const overview = apiPayload?.data;
  validateOverview(overview);
  report.checks.api = { httpStatus: apiResponse.status, overview };

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'ro-RO' });
  report.browserFields.browserSessionStatus = 'PASS';
  await context.addInitScript(({ token }) => {
    localStorage.setItem('agm.admin.session', JSON.stringify({ accessToken: token, expiresInSeconds: 300 }));
  }, { token: ownerAccessToken });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.url() === apiUrl) report.network.push({
      url: request.url(),
      method: request.method(),
      authorizationPresent: Boolean(request.headers().authorization),
      requestedAt: new Date().toISOString(),
    });
  });
  page.on('response', (response) => {
    if (response.url() === apiUrl) report.network.push({ url: response.url(), status: response.status(), respondedAt: new Date().toISOString() });
  });

  const navigation = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(navigation?.status() === 200, `TURN target HTTP ${navigation?.status()}`);
  await dismissFirstRun(page, report.checks);
  await page.waitForSelector('[data-turn-functional-overview][data-functional-verdict="READY_FOR_PRODUCT_OWNER_REVIEW"]', { timeout: 60_000 });
  await page.waitForSelector('[data-functional-zone]', { timeout: 30_000 });
  await dismissFirstRun(page, report.checks);
  const functionalNav = page.locator('a[href="#turn-functional-overview"]');
  await functionalNav.click();
  await page.waitForFunction(() => location.hash === '#turn-functional-overview');

  const ui = await page.evaluate(() => {
    const root = document.querySelector('[data-turn-functional-overview]');
    const cards = [...document.querySelectorAll('[data-functional-zone]')].map((card) => ({
      id: card.getAttribute('data-functional-zone'),
      status: card.getAttribute('data-functional-status'),
      title: card.querySelector('h4')?.textContent?.trim() || '',
      text: card.textContent?.trim() || '',
      actionHref: card.querySelector('a')?.getAttribute('href') || '',
    }));
    return {
      verdict: root?.getAttribute('data-functional-verdict'),
      contract: root?.getAttribute('data-functional-contract'),
      cardCount: cards.length,
      basicCount: document.querySelectorAll('[data-functional-tier="BASIC"] [data-functional-zone]').length,
      premiumCount: document.querySelectorAll('[data-functional-tier="PREMIUM"] [data-functional-zone]').length,
      cards,
      unavailable: Boolean(document.querySelector('.turn-functional-unavailable')),
      invalidUnknown: cards.filter((card) => card.status?.includes('UNKNOWN') && card.status !== 'UNKNOWN_LEGITIMATE'),
      unactionable: cards.filter((card) => !card.actionHref || !card.text.includes('Sursa reală') || !card.text.includes('Ce lipsește')),
      staticRuntimeGreen: document.querySelectorAll('[data-functional-status="STATIC_REFERENCE"].status-operational, [data-functional-status="UNKNOWN_LEGITIMATE"].status-operational').length,
      registryRuntimeGreen: document.querySelectorAll('.organization-map-card .status-light-green, .turn-agent-register .turn-light.active, .turn-entry-panel .turn-light.active').length,
    };
  });
  report.checks.ui = ui;
  assert(ui.contract === 'turn-functional-overview.v1', `Unexpected UI contract ${ui.contract}`);
  assert(ui.verdict === 'READY_FOR_PRODUCT_OWNER_REVIEW', `Unexpected UI verdict ${ui.verdict}`);
  assert(ui.cardCount === 23 && ui.basicCount === 10 && ui.premiumCount === 13, `Unexpected zone coverage ${ui.basicCount}/${ui.premiumCount}/${ui.cardCount}`);
  assert(!ui.unavailable, 'TURN rendered DATA UNAVAILABLE.');
  assert(ui.invalidUnknown.length === 0, `Unjustified UNKNOWN states: ${JSON.stringify(ui.invalidUnknown)}`);
  assert(ui.unactionable.length === 0, `Zones without source/missing/action: ${JSON.stringify(ui.unactionable)}`);
  assert(ui.staticRuntimeGreen === 0, 'Static/local zones are presented as operational green.');
  assert(ui.registryRuntimeGreen === 0, 'Registry-only content is presented as runtime green.');
  assert(report.network.some((entry) => entry.authorizationPresent === true), 'UI request did not carry real Owner Access authorization.');
  assert(report.network.some((entry) => entry.status === 200), 'UI did not receive functional overview HTTP 200.');
  assert(report.pageErrors.length === 0, `Page errors: ${report.pageErrors.join(' | ')}`);

  await page.locator('[data-turn-functional-overview]').screenshot({ path: resolve(evidenceRoot, 'turn-functional-overview.png') });
  await page.screenshot({ path: resolve(evidenceRoot, 'turn-functional-overview-full-page.png'), fullPage: true });
  report.browserFields.targetPageStatus = 'PASS';
  report.status = 'PASS';
  report.completedAt = new Date().toISOString();
  await context.close();
} catch (error) {
  report.failure = error instanceof Error ? error.stack || error.message : String(error);
  report.completedAt = new Date().toISOString();
} finally {
  if (browser) await browser.close();
  await writeFile(resolve(evidenceRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ status: report.status, evidenceRoot, browserFields: report.browserFields, failure: report.failure || null }, null, 2)}\n`);
}

if (report.status !== 'PASS') process.exitCode = 1;

function validateOverview(overview) {
  assert(overview?.contractVersion === 'turn-functional-overview.v1', 'Functional overview contract missing.');
  assert(overview?.verdict?.turnFunctionalCompleteness === 'READY_FOR_PRODUCT_OWNER_REVIEW', `Functional completeness is ${overview?.verdict?.turnFunctionalCompleteness}`);
  assert(overview?.verdict?.productOwnerAcceptance === 'NOT_GRANTED', 'Product Owner acceptance was inferred.');
  assert(overview?.verdict?.finalProductionPass === 'RETRACTED', 'FINAL Production PASS was inferred.');
  assert(overview?.summary?.totalZones === 23, `Expected 23 zones, got ${overview?.summary?.totalZones}`);
  assert(overview?.summary?.unresolvedUnknown === 0, `Unresolved UNKNOWN is ${overview?.summary?.unresolvedUnknown}`);
  assert(Array.isArray(overview?.zones) && overview.zones.length === 23, 'Zone payload is incomplete.');
  assert(new Set(overview.zones.map((zone) => zone.id)).size === 23, 'Zone ids are not unique.');
  assert(overview.zones.filter((zone) => zone.tier === 'BASIC').length === 10, 'Basic zone coverage is incomplete.');
  assert(overview.zones.filter((zone) => zone.tier === 'PREMIUM').length === 13, 'Premium zone coverage is incomplete.');
  for (const zone of overview.zones) {
    assert(zone.information && zone.source?.kind && zone.source?.label && zone.action?.label && zone.action?.href, `${zone.id} lacks information/source/action.`);
    assert(zone.status !== 'UNKNOWN' && zone.status !== 'UNCERTAIN', `${zone.id} contains unresolved ${zone.status}.`);
    if (zone.status === 'UNKNOWN_LEGITIMATE') {
      assert(zone.legitimateUnknown === true && zone.unknownReason && zone.implementation, `${zone.id} lacks legitimate UNKNOWN justification.`);
      assert(zone.source.kind === 'LOCAL_DEVICE', `${zone.id} claims legitimate UNKNOWN outside a local source.`);
    }
    if (zone.status === 'OPERATIONAL') {
      assert(!['STATIC_CONTRACT', 'LOCAL_DEVICE'].includes(zone.source.kind), `${zone.id} derives operational green from ${zone.source.kind}.`);
      assert(zone.source.observedAt, `${zone.id} lacks an observation timestamp.`);
    }
    if (zone.status === 'OBSERVED') {
      assert(zone.source.kind === 'EVENT_STORE', `${zone.id} derives observed activity from ${zone.source.kind}.`);
      assert(zone.source.observedAt, `${zone.id} observed activity lacks a timestamp.`);
    }
    if (zone.status === 'ATTENTION') assert(zone.missing && zone.implementation, `${zone.id} ATTENTION lacks cause/action.`);
  }
}

async function dismissFirstRun(page, checks) {
  const legalAcceptance = page.locator('#acceptLegalNotice');
  if (await legalAcceptance.isVisible().catch(() => false)) {
    await legalAcceptance.click();
    await page.waitForSelector('.legal-acceptance-overlay', { state: 'detached', timeout: 15_000 });
    checks.legalAcceptance = 'ACCEPTED_FOR_CONTROLLED_SESSION';
  }
  const skipTutorial = page.locator('#skipTutorial');
  if (await skipTutorial.isVisible().catch(() => false)) {
    await skipTutorial.click();
    await page.waitForSelector('.tutorial-overlay', { state: 'detached', timeout: 15_000 });
    checks.firstRunTutorial = 'DISMISSED_FOR_CONTROLLED_SESSION';
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
