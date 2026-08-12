import assert from 'node:assert/strict';
import { canonicalPremiumHubs, projectHub00, renderHub00 } from '../src/premium-hub00';
import { createDraftTripContext } from '../src/premium-operational-context';
assert.equal(canonicalPremiumHubs.length,7); assert.deepEqual(canonicalPremiumHubs.map((h)=>h.id),['HUB-01','HUB-02','HUB-03','HUB-04','HUB-05','HUB-06','HUB-07']);
assert.deepEqual(projectHub00(null,[]),{state:'empty',reason:'NO_ACTIVE_TRIP'});
const trip=createDraftTripContext({tripId:'trip-one',now:new Date().toISOString()}); const projection=projectHub00(trip,[]); assert.equal(projection.state,'active');
const html=renderHub00(projection,(v)=>v); assert.match(html,/HUB-00/); assert.match(html,/data-trip-id="trip-one"/); assert.match(html,/data-lifecycle/); assert.match(html,/data-open-items/); assert.match(html,/data-timeline/); assert.doesNotMatch(html,/simulated|mock/i);
assert.equal(projectHub00({schemaVersion:'wrong'},[]).state,'invalid');
console.log('P2 HUB-00 single TripContext/lifecycle/shared projection/honest fallback: PASS');
