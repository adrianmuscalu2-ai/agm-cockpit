import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foundation = readFileSync(new URL('../src/styles/00-foundation.css', import.meta.url), 'utf8');
const domain = readFileSync(new URL('../src/styles/20-domain-tools.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../src/styles/50-roadmap-responsive.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

assert.match(foundation, /-webkit-text-size-adjust:\s*100%/);
assert.match(foundation, /\.global-quick-actions[\s\S]*grid-template-columns:\s*repeat\(3,/);
assert.match(foundation, /safe-area-inset-bottom/);
assert.match(domain, /@media \(max-width: 520px\)[\s\S]*\.basic-analysis-steps/);
assert.match(domain, /min-height:\s*clamp\(180px, 34dvh, 260px\)/);
assert.match(domain, /\.analysis-result-actions button[\s\S]*min-height:\s*50px/);
assert.match(domain, /@media \(max-width: 380px\)/);
assert.match(responsive, /Android bottom navigation clearance/);
assert.match(responsive, /bottom:\s*calc\(24px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(responsive, /padding-bottom:\s*calc\(112px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(responsive, /white-space:\s*nowrap/);

for (const action of ['transport-document', 'tachograph-analysis', 'dashboard-text-analysis']) {
  assert.ok(main.includes(`'${action}'`), `Basic action ${action} must remain registered`);
}
for (const resultClass of ['transport-document-analysis', 'tachograph-analysis', 'dashboard-text-analysis']) {
  assert.ok(main.includes(resultClass), `Result surface ${resultClass} must remain available`);
}

console.log('AGM Basic Sprint 4 responsive UX contract: PASS');
