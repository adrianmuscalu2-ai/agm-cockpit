import type { OperationalEventV1 } from './premium-operational-context/operational-event';
import type { TripContext } from './premium-operational-context/trip-context.types';

export const HUB00_CONTRACT = { id:'HUB-00', route:'/premium', singleActiveTrip:true, contextVersion:'trip-context.v1' } as const;
export const canonicalPremiumHubs = [
  {id:'HUB-01',status:'available',href:'/before-departure.html'}, {id:'HUB-02',status:'planned'},
  {id:'HUB-03',status:'available',href:'/after-departure.html'}, {id:'HUB-04',status:'partial'},
  {id:'HUB-05',status:'partial'}, {id:'HUB-06',status:'partial',href:'/premium/ladungssicherung'},
  {id:'HUB-07',status:'foundation'},
] as const;

export type Hub00Projection = { state:'active'; trip:TripContext; timeline:readonly OperationalEventV1[] } | { state:'empty'|'invalid'; reason:string };
export function projectHub00(context: unknown, events: unknown): Hub00Projection {
  if (context == null) return {state:'empty',reason:'NO_ACTIVE_TRIP'};
  const trip=context as TripContext;
  if (trip.schemaVersion!=='trip-context.v1'||!trip.tripId||!Number.isInteger(trip.contextVersion)) return {state:'invalid',reason:'INVALID_TRIP_CONTEXT'};
  const timeline=Array.isArray(events)?(events as OperationalEventV1[]).filter((event)=>event.tripId===trip.tripId).sort((a,b)=>a.aggregateVersion-b.aggregateVersion):[];
  return {state:'active',trip,timeline};
}
export function readHub00Projection(storage:Pick<Storage,'getItem'>):Hub00Projection {
  try { return projectHub00(JSON.parse(storage.getItem('agm.premium.trip-context.v1')??'null'),JSON.parse(storage.getItem('agm.premium.operational-events.v1')??'[]')); }
  catch { return {state:'invalid',reason:'LOCAL_CONTEXT_UNREADABLE'}; }
}
export function renderHub00(projection:Hub00Projection,escapeHtml:(value:string)=>string) {
  const context=projection.state==='active'?`<section class="premium-hub00-trip" data-trip-id="${escapeHtml(projection.trip.tripId)}"><strong>${escapeHtml(projection.trip.transportJob.id??projection.trip.tripId)}</strong><span data-lifecycle>${escapeHtml(projection.trip.lifecycleState)}</span><span data-context-version>v${projection.trip.contextVersion}</span><p data-flags>${escapeHtml(projection.trip.flags.join(', ')||'NO FLAGS')}</p><p data-open-items>${projection.trip.openItems.length} open items</p><p data-timeline>${projection.timeline.length} timeline events</p></section>`:`<section class="premium-hub00-empty" data-state="${projection.state}"><strong>NO ACTIVE TRIP</strong><p>${escapeHtml(projection.reason)}</p></section>`;
  const hubs=canonicalPremiumHubs.map((hub)=>`<li data-hub="${hub.id}" data-status="${hub.status}">${'href' in hub?`<a href="${hub.href}">${hub.id}</a>`:`<span>${hub.id}</span>`}<small>${hub.status}</small></li>`).join('');
  return `<section class="premium-hub00" aria-labelledby="hub00-title"><div><span>HUB-00</span><h2 id="hub00-title">AGM Premium Cockpit</h2></div>${context}<nav aria-label="Premium operational hubs"><ul>${hubs}</ul></nav></section>`;
}
