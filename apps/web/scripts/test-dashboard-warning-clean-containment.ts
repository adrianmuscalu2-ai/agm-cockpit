import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashboardWarningContainmentCopy, dashboardWarningVisionEnabled, DASHBOARD_WARNING_VISION_DEFAULT, DASHBOARD_WARNING_VISION_FLAG } from '../src/dashboard-warning-vision.feature';
import { basicLanguageCodes } from '../src/language-registry';

assert.equal(DASHBOARD_WARNING_VISION_FLAG, 'VITE_DASHBOARD_WARNING_VISION_ENABLED');
assert.equal(DASHBOARD_WARNING_VISION_DEFAULT, false);
assert.equal(dashboardWarningVisionEnabled(undefined), false);
assert.equal(dashboardWarningVisionEnabled('false'), false);
assert.equal(dashboardWarningVisionEnabled('TRUE'), false);
assert.equal(dashboardWarningVisionEnabled('true'), true);

for (const language of basicLanguageCodes) {
  const copy = dashboardWarningContainmentCopy(language);
  assert.ok(copy.title.trim()); assert.ok(copy.description.trim()); assert.ok(copy.action.trim());
}

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const productionEnvironment = readFileSync(new URL('../.env.production', import.meta.url), 'utf8');
assert.match(productionEnvironment, /^VITE_DASHBOARD_WARNING_VISION_ENABLED=false$/m);
assert.match(main, /renderDashboardWarningKnowledgeCard/);
assert.match(main, /\/knowledge\/martori-bord/);
assert.match(main, /dashboardWarningVisionEnabled\(import\.meta\.env\.VITE_DASHBOARD_WARNING_VISION_ENABLED\)/);
assert.match(main, /if \(!dashboardWarningVisionEnabled[\s\S]*window\.location\.assign\('\/knowledge\/martori-bord'\)/);
console.log('Dashboard Warning clean containment: PASS');
