import type { OperationalCase } from './situation-router.types';
import { createOperationalCase, transitionOperationalCase } from './operational-case.machine';
import type { BasicLanguageCode } from '../language-registry';

export const OPERATIONAL_CASE_STORAGE_KEY = 'agm.premium.operational-case.v1';
export const LEGACY_PRE_DEPARTURE_KEY = 'agm.e6.pre-departure.session.v1';
export const LEGACY_AFTER_DEPARTURE_KEY = 'agm.poc02.after-departure.session.v1';

export function saveOperationalCase(storage: Pick<Storage,'setItem'>, value: OperationalCase) {
  storage.setItem(OPERATIONAL_CASE_STORAGE_KEY, JSON.stringify(value));
}
export function restoreOperationalCase(storage: Pick<Storage,'getItem'>): OperationalCase | null {
  const raw = storage.getItem(OPERATIONAL_CASE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as OperationalCase;
    return value.schemaVersion === 1 && value.definitionVersion === 1 ? value : null;
  } catch { return null; }
}
export function migrationMarker(source: string) {
  let hash = 2166136261;
  for (const char of source) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `legacy.case.imported.v1:${(hash >>> 0).toString(16)}`;
}
export function migrateLegacyRequiredDocument(
  storage: Pick<Storage,'getItem'|'setItem'>,
  association?: { caseId:string; tripId:string; documentType:string; language:BasicLanguageCode },
) {
  const source=storage.getItem(LEGACY_PRE_DEPARTURE_KEY);
  if (!source) return null;
  const marker=migrationMarker(source);
  const markerKey=`agm.premium.migration.${marker}`;
  const existing=restoreOperationalCase(storage);
  if (storage.getItem(markerKey)==='complete' && existing) return existing;
  let value=createOperationalCase(association?.caseId??`recovery-${marker}`,'required-document',association?.language??'ro');
  try {
    const legacy=JSON.parse(source) as Record<string,unknown>;
    const valid=Array.isArray(legacy.contexts)&&typeof legacy.answers==='object'&&legacy.answers!==null;
    if (!valid||!association?.tripId||!association.documentType) {
      value=transitionOperationalCase(value,{type:'REQUIRE_RECOVERY',reason:'LEGACY_ASSOCIATION_AMBIGUOUS'});
    } else {
      value=transitionOperationalCase(value,{type:'SET_DATA',values:{tripId:association.tripId,documentType:association.documentType,legacySourceHash:marker,legacyAnswers:legacy.answers,legacyIssues:legacy.issues??{},legacyConfirmation:legacy.confirmation}});
      storage.setItem(markerKey,'complete');
    }
    saveOperationalCase(storage,value);
    return value;
  } catch {
    value=transitionOperationalCase(value,{type:'REQUIRE_RECOVERY',reason:'LEGACY_PAYLOAD_INVALID'});
    saveOperationalCase(storage,value); return value;
  }
}
