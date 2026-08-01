import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createWebBuildDefinition } from '../web-build-definition.mjs';

const definition = createWebBuildDefinition();
assert.deepEqual(definition.build.rollupOptions.input, {
  main: 'index.html',
  beforeDeparture: 'before-departure.html',
  afterDeparture: 'after-departure.html',
});
assert.equal(definition.plugins.length, 1);
assert.equal(definition.plugins[0].name, 'poc02-after-departure-entry');

const source = '<html><body><main>AGM</main></body></html>';
const transformed = definition.plugins[0].transformIndexHtml(source, {
  path: '/index.html',
});
assert.match(transformed, /data-poc02-entry="after-departure"/);
assert.match(
  transformed,
  /POC 02 · După Plecare \/ Nach der Abfahrt \/ After Departure/,
);
assert.equal(
  definition.plugins[0].transformIndexHtml(source, {
    path: '/before-departure.html',
  }),
  source,
);

const viteConfig = readFileSync(
  new URL('../vite.config.mjs', import.meta.url),
  'utf8',
);
const productionBuild = readFileSync(
  new URL('./build-web.mjs', import.meta.url),
  'utf8',
);
for (const consumer of [viteConfig, productionBuild]) {
  assert.match(consumer, /createWebBuildDefinition\(\)/);
  assert.doesNotMatch(consumer, /poc02-after-departure-entry/);
  assert.doesNotMatch(consumer, /afterDeparture:\s*'after-departure\.html'/);
}

console.log('SR-01 single Web build definition: PASS');
