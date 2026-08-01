import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderPremiumView, usesPremiumLayout } from '../src/premium-app';
import {
  isPremiumView,
  normalizePremiumRoute,
  PRE_001_SHELL_CONTRACT,
  premiumRouteForView,
  premiumRouteRegistry,
  premiumViewFromRoute,
} from '../src/premium-routes';

assert.equal(PRE_001_SHELL_CONTRACT.id, 'PRE-001');
assert.equal(new Set(premiumRouteRegistry.map(({ view }) => view)).size, premiumRouteRegistry.length);
assert.equal(new Set(premiumRouteRegistry.map(({ route }) => route)).size, premiumRouteRegistry.length);

for (const { view, route } of premiumRouteRegistry) {
  assert.equal(premiumViewFromRoute(route), view);
  assert.equal(premiumViewFromRoute(`${route}/`), view);
  assert.equal(premiumViewFromRoute(`${route}?source=test`), view);
  assert.equal(premiumViewFromRoute(`${route}#section`), view);
  assert.equal(premiumRouteForView(view), route);
  assert.equal(isPremiumView(view), true);
  assert.equal(usesPremiumLayout(view), true);
}

assert.equal(normalizePremiumRoute('///premium/team///?x=1'), '/premium/team');
assert.equal(premiumViewFromRoute('/premium/unknown'), undefined);
assert.equal(premiumRouteForView('home'), undefined);

const translate = (key: string) => key;
const escapeHtml = (value: string) => value;
const premiumHtml = renderPremiumView('premium', translate, escapeHtml)!;
const teamHtml = renderPremiumView('premiumTeam', translate, escapeHtml)!;

assert.match(premiumHtml, /<section class="premium-view" aria-labelledby="premium-title">/);
assert.match(premiumHtml, /href="\/premium\/team" data-module="premiumTeam"/);
assert.match(premiumHtml, /href="\/" data-module="home"/);
assert.match(teamHtml, /<section class="premium-team-view" aria-labelledby="premium-team-title">/);
assert.match(teamHtml, /href="\/premium" data-module="premium"/);

const shellSource = readFileSync(new URL('../src/premium-shell.ts', import.meta.url), 'utf8');
const routesSource = readFileSync(new URL('../src/premium-routes.ts', import.meta.url), 'utf8');
for (const forbiddenDomainImport of [
  'premium-operational-context',
  'premium-ai-governance',
  'premium-copilot',
  'premium-load-safety',
]) {
  assert.ok(!shellSource.includes(forbiddenDomainImport));
  assert.ok(!routesSource.includes(forbiddenDomainImport));
}

console.log('PRE-001 Premium Shell & Command Center contract: PASS');
