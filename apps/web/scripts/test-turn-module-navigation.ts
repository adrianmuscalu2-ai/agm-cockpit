import assert from 'node:assert/strict';
import { turnModuleNavigationGroups, turnModuleNavigationRegistry } from '../src/turn-module-navigation.registry';
import { readFileSync } from 'node:fs';

const view = readFileSync(new URL('../src/turn-command-center.view.ts', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../src/turn-command-navigation.ts', import.meta.url), 'utf8');

assert.equal(new Set(turnModuleNavigationRegistry.map((entry) => entry.moduleId)).size, turnModuleNavigationRegistry.length);
assert.ok(turnModuleNavigationRegistry.length >= 18);
assert.ok(turnModuleNavigationGroups.every((group) => group.moduleIds.every((id) => turnModuleNavigationRegistry.some((entry) => entry.moduleId === id))));
assert.ok(turnModuleNavigationRegistry.every((entry) => entry.moduleId && entry.displayName && entry.route && entry.canonicalSource && entry.environment && entry.validationStatus));
assert.match(view, /renderTurnModuleNavigation\(\)/);
assert.match(view, /data-turn-module-search/);
assert.match(navigation, /localStorage\.setItem\(TURN_LAST_PAGE_KEY/);
assert.match(navigation, /data-turn-module-search-value/);

console.log('TURN modular navigation registry: PASS');
