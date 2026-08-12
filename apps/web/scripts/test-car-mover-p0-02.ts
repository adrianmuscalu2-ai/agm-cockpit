import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { basicLanguageCodes } from '../src/language-registry';
import { carMoverI18nKeys, carMoverText } from '../src/car-mover/car-mover.i18n';
import { renderCarMoverView } from '../src/car-mover/car-mover.view';
import { premiumRouteForView, premiumViewFromRoute } from '../src/premium-routes';

assert.equal(premiumRouteForView('carMover'), '/car-mover');
assert.equal(premiumViewFromRoute('/car-mover'), 'carMover');
for (const language of basicLanguageCodes) {
  const html=renderCarMoverView(language);
  assert.match(html,/data-car-mover-root/);
  assert.match(html,/PASSENGER_CAR/);
  assert.match(html,/TRACTOR_UNIT/);
  for(const key of carMoverI18nKeys) assert.ok(carMoverText(language,key).trim(),`${language}:${key}`);
}
const runtime=readFileSync(resolve(import.meta.dirname,'../src/car-mover/car-mover.runtime.ts'),'utf8');
assert.match(runtime,/carMoverClient\.create/);
assert.match(runtime,/carMoverClient\.transition/);
assert.match(runtime,/carMoverClient\.file/);
assert.doesNotMatch(runtime,/Onlogist|MOCCA|WhatsApp|Gmail|invoice|payment/i);
const client=readFileSync(resolve(import.meta.dirname,'../src/car-mover/car-mover.client.ts'),'utf8');
assert.match(client,/USER_ACCESS_TOKEN_KEY/);
assert.match(client,/Authorization:`Bearer/);
assert.doesNotMatch(client,/companyId|tenantId/);
console.log('Car Mover P0-02 route/UI/i18n 9\/9/auth boundary: PASS');
