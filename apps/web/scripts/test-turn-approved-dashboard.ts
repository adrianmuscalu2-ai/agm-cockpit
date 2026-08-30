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

assert.equal(agentGovernanceRegistry.length, 37, 'Registry must contain the three final-language agents');
assert.equal((html.match(/data-entry-agent-id=/g) ?? []).length, 37, 'Entry panel must show every registered agent');
assert.equal((html.match(/data-agent-row-id=/g) ?? []).length, 36, 'Canonical table must show every non-P9 registry row');
for (const id of ['website-content-visual-guardian', 'website-runtime-release-guardian']) {
  assert.match(html, new RegExp(`data-agent-row-id="${id}"`));
}
for (const id of ['agent-linguistic-ro-de', 'agent-linguistic-ro-en', 'agent-linguistic-de-en']) {
  assert.equal(agentGovernanceRegistry.find((agent) => agent.id === id)?.status, 'active', `${id} must reflect the implemented APP-006 runtime`);
}
for (const id of ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv']) {
  assert.equal(agentGovernanceRegistry.find((agent) => agent.id === id)?.status, 'active', `${id} must be operational`);
  assert.match(html, new RegExp(`data-agent-row-id="${id}"`));
  assert.match(html, new RegExp(`data-live-agent-id="${id}"`));
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
