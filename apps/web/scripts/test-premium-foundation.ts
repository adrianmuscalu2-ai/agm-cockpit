import assert from 'node:assert/strict';

import { premiumAgents } from '../src/premium-agents';
import { premiumAgentStateDefinition } from '../src/premium-agent-states';
import { renderPremiumView, usesPremiumLayout } from '../src/premium-app';
import {
  isPremiumView,
  premiumRouteForView,
  premiumViewFromRoute,
} from '../src/premium-routes';

const translate = (key: string) => key;
const escapeHtml = (value: string) => value;

const premiumHtml = renderPremiumView('premium', translate, escapeHtml);
const teamHtml = renderPremiumView('premiumTeam', translate, escapeHtml);

assert.equal(premiumRouteForView('premium'), '/premium');
assert.equal(premiumRouteForView('premiumTeam'), '/premium/team');
assert.equal(premiumViewFromRoute('/premium'), 'premium');
assert.equal(premiumViewFromRoute('/premium/team'), 'premiumTeam');
assert.equal(premiumViewFromRoute('/'), undefined);
assert.equal(isPremiumView('premium'), true);
assert.equal(isPremiumView('premiumTeam'), true);
assert.equal(isPremiumView('home'), false);
assert.equal(usesPremiumLayout('premium'), true);
assert.equal(usesPremiumLayout('premiumTeam'), true);
assert.equal(usesPremiumLayout('home'), false);

assert.ok(premiumHtml?.includes('href="/premium/team"'));
assert.ok(premiumHtml?.includes('href="/"'));
assert.ok(teamHtml?.includes('href="/premium"'));
assert.ok(teamHtml?.includes('href="/"'));
assert.equal(renderPremiumView('home', translate, escapeHtml), undefined);

assert.equal(premiumAgents.length, 8);
assert.deepEqual(
  premiumAgents.map((agent) => agent.id),
  ['mentor', 'atlas', 'inspector', 'transport', 'load-safety', 'communication', 'documents', 'journal'],
);
assert.ok(premiumAgents.every((agent) => agent.state === 'preparing'));
assert.equal(
  premiumAgentStateDefinition('preparing').translationKey,
  'premium.team.status.preparing',
);
assert.equal(
  teamHtml?.match(/class="premium-team-agent premium-team-agent-preparing"/g)?.length,
  premiumAgents.length,
);
assert.equal(teamHtml?.includes('premium-team-agent-available'), false);
assert.equal(teamHtml?.includes('premium-team-agent-active'), false);

console.log('Premium navigation and agent state tests: PASS');
