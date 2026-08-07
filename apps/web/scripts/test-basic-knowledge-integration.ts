import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { shellViewFromRoute } from '../src/app-shell/navigation.contract';
import { publishedLegalKnowledge } from '../src/legal-knowledge/legal-knowledge.registry';
import {
  basicKnowledgeDestinations,
  basicKnowledgeDestinationFromRoute,
  packagesForBasicKnowledgeDestination,
} from '../src/legal-knowledge/knowledge-navigation.registry';

const expected = [
  ['/knowledge/legislatie', ['KB-LEGAL-DRT-001', 'KB-LEGAL-TRANSPORT-DOCS-001']],
  ['/knowledge/tahograf', ['KB-LEGAL-TACH-001']],
  ['/knowledge/martori-bord', ['KB-VEHICLE-WARN-001']],
  ['/knowledge/ancorarea-marfii', ['KB-LEGAL-CARGO-SECURING-001']],
] as const;

assert.equal(basicKnowledgeDestinations.length, 4);
const published = publishedLegalKnowledge(new Date('2026-08-02'));
const mainSource = readFileSync(resolve('src', 'main.ts'), 'utf8');

for (const [route, packageIds] of expected) {
  const destination = basicKnowledgeDestinationFromRoute(route);
  assert.ok(destination, `Missing Basic Knowledge destination for ${route}`);
  assert.equal(shellViewFromRoute(route), 'legal', `Shell cannot resolve ${route}`);
  assert.match(mainSource, new RegExp(route.replaceAll('/', '\\/')), `Basic button does not expose ${route}`);
  assert.deepEqual(
    packagesForBasicKnowledgeDestination(destination, published).map(({ id }) => id),
    [...packageIds],
    `Wrong package loaded for ${route}`,
  );
}

assert.equal(new Set(expected.map(([route]) => route)).size, expected.length);
assert.match(mainSource, /knowledgeDestination \? '' : `<header class="profile-heading">/);
assert.match(mainSource, /class="knowledge-driver-action"><strong>Ce faci:<\/strong>/);
assert.match(mainSource, /<summary>Vezi regula juridică<\/summary>/);

console.log('AGM Basic Knowledge Integration: PASS');
