import type { AnyAuthorizedSituationId, AuthorizedSituationId, SituationDefinition } from './situation-router.types';

export const authorizedSituationRegistry: Readonly<Record<AnyAuthorizedSituationId, SituationDefinition>> = {
  'required-document': {
    id: 'required-document', version: 1, hub: 'BEFORE_DEPARTURE', initialState: 'QUALIFYING',
    i18nKeyPrefix: 'situation.requiredDocument',
    steps: ['identify-document','document-availability','capture-original','ocr-review','document-check','remediation','ready-verdict'],
  },
  'road-control': {
    id: 'road-control', version: 1, hub: 'AFTER_DEPARTURE', initialState: 'SAFETY_GATE',
    i18nKeyPrefix: 'situation.roadControl',
    steps: ['safe-interaction','safe-stop','qualify-request','contextual-evidence','human-review','contextual-translation','contextual-communication','case-disposition'],
  },
  'trip-context': batch('trip-context','situation.tripContext'),
  'vehicle-safety': batch('vehicle-safety','situation.vehicleSafety'),
  'load-securing': batch('load-securing','situation.loadSecuring'),
  'tachograph-time': batch('tachograph-time','situation.tachographTime'),
  'adr-compliance': batch('adr-compliance','situation.adrCompliance'),
  'route-compatibility': batch('route-compatibility','situation.routeCompatibility'),
  'night-weather': batch('night-weather','situation.nightWeather'),
  'driver-fitness': batch('driver-fitness','situation.driverFitness'),
  'ready-gate': batch('ready-gate','situation.readyGate'),
  'unsafe-interaction': after('unsafe-interaction','situation.unsafeInteraction'),
  'immediate-danger': after('immediate-danger','situation.immediateDanger'),
  'incident-accident': after('incident-accident','situation.incidentAccident'),
  'vehicle-breakdown': after('vehicle-breakdown','situation.vehicleBreakdown'),
  'driver-fatigue': after('driver-fatigue','situation.driverFatigue'),
  'cargo-issue': after('cargo-issue','situation.cargoIssue'),
  'route-blocked': after('route-blocked','situation.routeBlocked'),
  'weather-road': after('weather-road','situation.weatherRoad'),
  'language-barrier': after('language-barrier','situation.languageBarrier'),
  'route-document': after('route-document','situation.routeDocument'),
  'independent-communication': after('independent-communication','situation.independentCommunication'),
  'arrival-closeout': after('arrival-closeout','situation.arrivalCloseout'),
  'final-report-archive': after('final-report-archive','situation.finalReportArchive'),
};

function batch(id:AuthorizedSituationId,i18nKeyPrefix:string):SituationDefinition{return {id,version:1,hub:'BEFORE_DEPARTURE',initialState:'QUALIFYING',i18nKeyPrefix,steps:['qualify','verify','remediate','verdict']};}
function after(id:AnyAuthorizedSituationId,i18nKeyPrefix:string):SituationDefinition{return {id,version:1,hub:'AFTER_DEPARTURE',initialState:id==='unsafe-interaction'||id==='immediate-danger'?'SAFETY_GATE':'QUALIFYING',i18nKeyPrefix,steps:['safe-interaction','safe-stop','qualify','verify','remediate','verdict']};}

export const executableSituationIds = Object.freeze(Object.keys(authorizedSituationRegistry) as AnyAuthorizedSituationId[]);
