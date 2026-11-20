// Uses an already attached, authorized Commander browser. Never imports tokens,
// creates a session, changes a binding or calls a provider outside the normal UI.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const endpoint = process.env.AGM_AUDIT_CDP_URL;
if (!endpoint || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(endpoint)) throw new Error('EXISTING_CONTROLLED_COMMANDER_BROWSER_REQUIRED');
const browser = await chromium.connectOverCDP(endpoint);
const page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().startsWith('https://app.agmcockpit.com/') && candidate.url().includes('turn'));
if (!page || !await page.locator('[data-agmatcc-ai-question]').isVisible()) throw new Error('EXISTING_AUTHENTICATED_TURN_PAGE_REQUIRED');
const output = new URL('../evidence/agmatcc-turn-integration-20261120/', import.meta.url);
mkdirSync(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), target: page.url(), scope: 'Real current Commander UI -> authenticated API -> Luna -> source reads -> existing journal', tests: [], acceptance: 'PARTIAL_REQUIRES_SEMANTIC_REVIEW' };
const cases = [
  ['A', 'Care este starea agenților din TURN?', 'agents'],
  ['B', 'Funcționează telemetria TURN?', 'telemetry'],
  ['C', 'Ce incidente au afectat AGMaTCC și care este situația lor?', null],
  ['D', 'Ce probleme au reapărut după ultimele versiuni? Nu presupune relații fără dovezi.', null],
  ['E', 'Ce agenți sau orchestratori au blocaje și de ce?', 'authority'],
  ['F', 'Mai sosesc semnale recente de la componente sau au încetat să dea semne de viață?', 'telemetry'],
  ['G', 'Explică-mi ultima stare pe care ai găsit-o și de ce ai considerat-o astfel.', null],
  ['H', 'Poți consulta Risk and Knowledge și Agent and Chain Performance cu sesiunea mea curentă?', 'connections'],
];
try {
  await page.locator('[data-agmatcc-new-conversation]').click();
  for (const [id, question, expectedSource] of cases) {
    await page.locator('[data-agmatcc-ai-question]').fill(question);
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/agmatcc-copilot/respond') && response.request().method() === 'POST', { timeout: 90000 }),
      page.locator('[data-agmatcc-ai-send]').click(),
    ]);
    const payload = await response.json();
    const data = payload.data;
    const reads = data?.sourceReads ?? [];
    const routeObserved = expectedSource === null || reads.some(read => read.source === expectedSource);
    report.tests.push({ id, question, httpStatus: response.status(), routeObserved, result: data, verdict: !response.ok() ? 'FAIL_HTTP' : !routeObserved ? 'FAIL_SOURCE_ROUTING' : 'OBSERVED_REQUIRES_SEMANTIC_REVIEW' });
    await page.locator('[data-agmatcc-ai-send]').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('[data-agmatcc-ai-send]')?.disabled, undefined, { timeout: 30000 });
    // Normal UI writes its existing AI_RESPONSE journal. Never call the business
    // event store separately or synthesize a successful test assertion.
    if (!response.ok() || data?.errorCode) break;
  }
  report.authorizationChecks = await page.evaluate(async () => {
    // Use the current application's bearer only inside its browser origin.
    // Return statuses, never credentials or response bodies from protected stores.
    const session = JSON.parse(sessionStorage.getItem('agm.admin.session') ?? 'null');
    if (!session?.accessToken) return [{ state: 'CURRENT_SESSION_UNAVAILABLE' }];
    const results = [];
    for (const path of ['/agmatcc-copilot/control-status', '/acpm', '/governance-v2/risk-knowledge/search?q=telemetrie']) {
      const response = await fetch(`https://api.agmcockpit.com/api/v1${path}`, { cache: 'no-store', headers: { Authorization: `Bearer ${session.accessToken}` } });
      results.push({ path, status: response.status });
    }
    return results;
  });
} finally {
  report.finishedAt = new Date().toISOString();
  const name = `production-dialogue-${report.startedAt.replace(/[:.]/g, '-')}.json`;
  writeFileSync(new URL(name, output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ artifact: name, tests: report.tests.map(({ id, verdict }) => ({ id, verdict })), acceptance: report.acceptance }));
  // Do not close the user's browser or session.
}
process.exit(0); // Drop this CDP client only; leave the user's browser running.
