import assert from 'node:assert/strict';
import {
  APP_SHELL_NAVIGATION_CONTRACT,
  isTurnSectionFragment,
  routeForShellView,
  shellRouteRegistry,
  shellViewFromRoute,
} from '../src/app-shell/navigation.contract';
import { readFileSync } from 'node:fs';
import { appViewModuleRegistry } from '../src/app-shell/view-module.registry';

assert.equal(APP_SHELL_NAVIGATION_CONTRACT.id, 'APP-001');
assert.equal(new Set(shellRouteRegistry.map((entry) => entry.view)).size, shellRouteRegistry.length);
assert.equal(new Set(shellRouteRegistry.map((entry) => entry.canonicalRoute)).size, shellRouteRegistry.length);

for (const entry of shellRouteRegistry) {
  assert.equal(shellViewFromRoute(entry.canonicalRoute), entry.view);
  assert.equal(routeForShellView(entry.view), entry.canonicalRoute);
  for (const alias of entry.aliases) assert.equal(shellViewFromRoute(alias), entry.view);
  assert.ok(appViewModuleRegistry.some((module) => module.view === entry.view));
}

assert.equal(shellViewFromRoute('/unknown'), undefined);
assert.equal(shellViewFromRoute('/'), 'basic');
assert.equal(routeForShellView('basic'), '/basic');
assert.equal(routeForShellView('home'), '/home');
assert.equal(isTurnSectionFragment('turn-monitoring'), true);
assert.equal(isTurnSectionFragment('incident-journal'), true);
assert.equal(isTurnSectionFragment('email'), false);


const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.match(main, /window\.addEventListener\('popstate'/);
assert.match(main, /window\.addEventListener\('hashchange'/);
assert.match(main, /registerServiceWorker\(\);\s*render\(\);/);
assert.match(main, /shellViewFromRoute\(normalizedRoute\) \?\? 'home'/);
assert.match(main, /routeForShellView\(view\) \?\? '\/'/);

console.log('APP-001 App Shell navigation contract: PASS');
