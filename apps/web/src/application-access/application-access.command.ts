import type { AndroidActionResolution } from '../android-action-layer/android-action.contract';
import { readApplicationAccess, type ApplicationAccessStorage } from './application-access.storage';

export function resolveProfileApplicationCommand(text: string, storage: ApplicationAccessStorage): AndroidActionResolution | null {
  const normalize = (value:string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const match = /^(?:deschide|porneste|open|launch|offne|starte)\s+(?:aplicatia\s+|the app\s+)?(.+?)[.!?]*$/.exec(normalize(text));
  if (!match) return null;
  const entries = readApplicationAccess(storage).entries.filter(entry => normalize(entry.appName) === match[1] || normalize(entry.packageName) === match[1]);
  if (!entries.length) return null;
  if (entries.length > 1) return {contractVersion:'android-action-resolution.v1',status:'CLARIFICATION_REQUIRED',reason:'APPLICATION_NAME_AMBIGUOUS',source:'REQUEST',confirmation:'NONE'};
  return {contractVersion:'android-action-resolution.v1',status:'RESOLVED',action:'OPEN_APP',reason:'PROFILE_APPLICATION_SELECTED',source:'REQUEST',confirmation:'USER_COMMAND',payload:{value:entries[0]!.packageName}};
}
