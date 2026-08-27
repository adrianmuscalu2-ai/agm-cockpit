import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderPremiumView } from '../src/premium-app';
import { premiumRouteForView, premiumViewFromRoute } from '../src/premium-routes';

const routes = {
  carMover:'/car-mover', carMoverMenu:'/car-mover/menu', carMoverPlanning:'/car-mover/planning',
  carMoverActive:'/car-mover/active-transfer', carMoverCompletion:'/car-mover/completion-incidents',
  carMoverAccounting:'/car-mover/accounting', carMoverGuide:'/car-mover/guide', carMoverArchive:'/car-mover/archive',
} as const;

for (const [view, route] of Object.entries(routes)) {
  assert.equal(premiumRouteForView(view), route);
  assert.equal(premiumViewFromRoute(route), view);
  assert.equal(premiumViewFromRoute(`${route}/?field=1`), view);
}

const render = (view: keyof typeof routes) => renderPremiumView(view, (key) => key, (value) => value, 'ro') ?? '';
const hero = render('carMover');
const menu = render('carMoverMenu');
assert.match(hero, /href="\/car-mover\/menu" data-module="carMoverMenu"/);
assert.match(hero, /href="\/premium\/copilot" data-module="premiumCopilot"/);
assert.match(hero, /href="\/ocr" data-module="ocr"/);
assert.match(hero, /href="\/premium\/voice" data-module="premiumVoice"/);
assert.doesNotMatch(hero, /data-module="carMoverPlanning"/);
assert.match(menu, /href="\/ocr" data-module="ocr" data-car-mover-quick="ocr"/);
assert.match(menu, /href="\/premium\/voice" data-module="premiumVoice" data-car-mover-quick="voice"/);
for (const [view, route] of Object.entries(routes).filter(([view]) => !['carMover','carMoverMenu'].includes(view))) {
  assert.match(menu, new RegExp(`href="${route.replaceAll('/','\\/')}" data-module="${view}"`));
  const moduleHtml = render(view as keyof typeof routes);
  assert.match(moduleHtml, /href="\/car-mover\/menu" data-module="carMoverMenu"/);
  assert.match(moduleHtml, /href="\/car-mover" data-module="carMover"/);
  assert.match(moduleHtml, /href="\/ocr" data-module="ocr" data-car-mover-quick="ocr"/);
  assert.match(moduleHtml, /href="\/premium\/voice" data-module="premiumVoice" data-car-mover-quick="voice"/);
  assert.doesNotMatch(moduleHtml, /placeholder|în pregătire|coming soon/i);
}

const planning = render('carMoverPlanning');
assert.match(planning, /PLATFORM INTAKE & DEDUPLICATION/);
assert.match(planning, /data-opportunity-planning/);
assert.match(planning, /decizia umană explicită/);
const active = render('carMoverActive');
assert.match(active, /ACCEPTED → PICKUP protocol → IN_PROGRESS → ARRIVED → HANDOVER → COMPLETED/);
assert.match(active, /data-car-mover-create/);
assert.match(active, /Camera \/ OCR pentru excepții/);
const completion = render('carMoverCompletion');
assert.match(completion, /INCIDENT ≠ HOLD ≠ CANCELLATION/);
assert.match(completion, /OPEN INCIDENT ≠ BLOCKED APPLICATION/);
assert.match(completion, /data-car-mover-incident/);
const accounting = render('carMoverAccounting');
assert.match(accounting, /ESTIMATED ≠ ACTUAL/);
const guide = render('carMoverGuide');
assert.match(guide, /AGM Knowledge/);
assert.match(guide, /\/knowledge\/legislatie/);
const archive = render('carMoverArchive');
assert.match(archive, /45 zile/);
assert.match(archive, /PRESERVE/);

const root = resolve(import.meta.dirname, '..');
const runtime = readFileSync(resolve(root,'src/car-mover/car-mover.runtime.ts'),'utf8');
const client = readFileSync(resolve(root,'src/car-mover/car-mover.client.ts'),'utf8');
const main = readFileSync(resolve(root,'src/main.ts'),'utf8');
const premiumMic = readFileSync(resolve(root,'src/premium-copilot/copilot.view.ts'),'utf8');
assert.match(runtime,/carMoverClient\.create/);
assert.match(runtime,/carMoverClient\.transition/);
assert.match(runtime,/carMoverClient\.protocol/);
assert.match(runtime,/crypto\.subtle\.digest\('SHA-256'/);
assert.match(runtime,/carMoverClient\.createIncident/);
assert.match(runtime,/carMoverClient\.finance/);
assert.match(runtime,/carMoverClient\.invoice/);
assert.match(runtime,/carMoverClient\.analyzeOffers/);
assert.match(client,/authenticatedApiFetch/);
assert.doesNotMatch(client,/USER_ACCESS_TOKEN_KEY|Authorization:`Bearer/);
assert.match(main,/!state\.view\.startsWith\('carMover'\)/);
assert.match(premiumMic,/class="copilot-mic"/);
assert.doesNotMatch(`${hero}${menu}${planning}${active}${completion}${accounting}${guide}${archive}`,/class="copilot-mic"/);

console.log('CAR MOVER NAVIGATION PATH contract, six real modules, back paths and Premium microphone reuse: PASS');
