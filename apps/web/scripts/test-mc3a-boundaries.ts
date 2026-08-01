import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const sourceRoot = resolve(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const preDepartureImports = importsUnder(join(sourceRoot, 'pre-departure'));
const afterDepartureImports = importsUnder(join(sourceRoot, 'poc02-after-departure'));
const operationalContextImports = importsUnder(join(sourceRoot, 'premium-operational-context'));

assert.deepEqual(
  preDepartureImports.filter((item) => item.specifier.startsWith('../')),
  [{
    file: 'pre-departure/pre-departure.facade.ts',
    specifier: '../premium-operational-context/pre-departure.integration',
  }],
);
assert.deepEqual(
  afterDepartureImports.filter((item) => item.specifier.startsWith('../')),
  [
    {
      file: 'poc02-after-departure/after-departure.journey-adapter.ts',
      specifier: '../outbox',
    },
    {
      file: 'poc02-after-departure/after-departure.journey-adapter.ts',
      specifier: '../premium-operational-context',
    },
  ],
);
assert.deepEqual(
  operationalContextImports
    .filter((item) => item.specifier.startsWith('../'))
    .map((item) => item.specifier),
  ['../pre-departure/pre-departure.types'],
);

const premiumApp = readFileSync(join(sourceRoot, 'premium-app.ts'), 'utf8');
assert.ok(premiumApp.includes("import './premium-load-safety/load-safety.controller';"));

console.log('MC-3A module boundary characterization: PASS');

function importsUnder(directory: string) {
  return files(directory)
    .flatMap((file) => {
      const content = readFileSync(file, 'utf8');
      return [...content.matchAll(/(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g)]
        .map((match) => ({
          file: relative(sourceRoot, file).replaceAll('\\', '/'),
          specifier: match[1],
        }));
    })
    .sort((left, right) =>
      `${left.file}:${left.specifier}`.localeCompare(`${right.file}:${right.specifier}`));
}

function files(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    })
    .filter((file) => extname(file) === '.ts');
}
