import { mkdirSync, writeFileSync } from 'node:fs';
const output = new URL('../evidence/agmatcc-turn-integration-20261120/', import.meta.url);
mkdirSync(output, { recursive: true });
const at = new Date().toISOString();
const paths = ['/health', '/operations/turn/operational-truth', '/operations/turn/agent-accountability', '/operations/turn/operational-dashboard', '/acpm', '/governance-v2/risk-knowledge/search?q=telemetrie'];
const results = [];
for (const path of paths) {
  try {
    const response = await fetch(`https://api.agmcockpit.com/api/v1${path}`, { signal: AbortSignal.timeout(15000) });
    const body = await response.json().catch(() => null);
    results.push({ path, status: response.status, ...(path === '/operations/turn/operational-truth' || path === '/health' ? { body } : {}), authenticated: false });
  } catch (error) { results.push({ path, error: error.name, authenticated: false }); }
}
const report = { at, scope: 'Real production public HTTP and unauthenticated denial checks only; not authenticated Luna E2E', results };
writeFileSync(new URL(`public-boundary-${at.replace(/[:.]/g, '-')}.json`, output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(results.map(({ path, status, error }) => ({ path, status, error }))));
