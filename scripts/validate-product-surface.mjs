import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const contract = JSON.parse(readFileSync(new URL('config/agm-product-surface.json', root), 'utf8'));
const app = readFileSync(new URL('apps/web/src/main.ts', root), 'utf8');
const android = readFileSync(new URL('apps/web/public/android.html', root), 'utf8');
const websiteLayout = readFileSync(new URL('agmcockpit-website/src/components/WebsitePageLayout.astro', root), 'utf8');
const websiteRegistry = readFileSync(new URL('agmcockpit-website/src/data/feature-registry.ts', root), 'utf8');

assert.ok(app.includes(`const APP_VERSION = '${contract.appVersionLabel}'`));
assert.ok(android.includes(`Android ${contract.currentDevelopmentVersion}`));
assert.ok(android.includes(contract.androidDownloadPath));
assert.ok(!websiteLayout.includes('https://app.agmcockpit.com/'));
assert.ok(websiteLayout.includes('APLICAȚIE ÎNCHISĂ PENTRU BROWSER'));
assert.ok(websiteRegistry.includes(`version: '${contract.latestHistoricalBaseline}'`));

const evolution = readFileSync(new URL('agmcockpit-website/src/pages/evolution.astro', root), 'utf8');
for (const version of contract.historicalBaselines) assert.ok(evolution.includes(`version: '${version}'`));

console.log(`AGM ${contract.currentDevelopmentVersion}: Browser and Android share one product baseline; history through ${contract.latestHistoricalBaseline} preserved`);
