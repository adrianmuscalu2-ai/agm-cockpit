import assert from 'node:assert/strict';
import { agentGovernanceRegistry } from '../src/agent-governance.registry';
import { emptyIncidentFilters } from '../src/incident-journal';
import { renderTurnCommandCenter } from '../src/turn-command-center.view';

const html = renderTurnCommandCenter({
  language: 'ro',
  appVersion: 'test',
  incidents: [],
  incidentFilters: emptyIncidentFilters(),
});

assert.equal(agentGovernanceRegistry.length, 32, 'Registry must contain 31 approved agents plus P9');
assert.equal((html.match(/data-entry-agent-id=/g) ?? []).length, 32, 'Entry panel must show every agent and P9');
assert.equal((html.match(/data-agent-row-id=/g) ?? []).length, 31, 'Canonical table must show 31 rows');
for (const id of ['agent-linguistic-ro-de', 'agent-linguistic-ro-en', 'agent-linguistic-de-en']) {
  assert.equal(agentGovernanceRegistry.find((agent) => agent.id === id)?.status, 'active', `${id} must reflect the implemented APP-006 runtime`);
}
assert.equal((html.match(/id="turn-dashboard"/g) ?? []).length, 1, 'There must be one primary dashboard');
assert.match(html, /ARHITECTURĂ ȘI GUVERNANȚĂ/);
assert.match(html, /Atlas coordonează execuția; monitorizarea verifică independent/);
assert.match(html, /Inspector Șef Monitorizare/);
assert.match(html, /Autovalidare<\/dt><dd>Interzisă/);
assert.match(html, /class="turn-network-department ai-network"[\s\S]*P9 · CONTROL-PLANE INTERN[\s\S]*id="turn-p9"/);

assert.match(html, /id="turn-authority-control-plane"/);
assert.match(html, /data-authority-dashboard/);
assert.match(html, /id="turn-premium-network"/);
assert.match(html, /data-agent-network-detail/);
assert.match(html, /CHIEF-MONITORING-INSPECTOR/);
assert.doesNotMatch(html, /MON-010<\/h3>/);
assert.match(html, /SNAPSHOT ISTORIC \/ STALE/);

console.log('TURN approved dashboard contract: PASS');
