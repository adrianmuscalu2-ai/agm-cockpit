import { readProfile, type ProfileStorage } from '../profileSettings';
import { readApplicationAccess, type ApplicationAccessStorage } from './application-access.storage';

/** User-supplied local context, never a credential or an execution permission. */
export function profileConversationContext(query:string, session:ProfileStorage, local:ApplicationAccessStorage):string | undefined {
  const normalized=query.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!/\b(profil|profilul|profile|meu|mea|mele|my|mein|meine|aplicatii|aplicatiile|apps|applications)\b/.test(normalized))return undefined;
  const profile=readProfile(session);
  const applications=readApplicationAccess(local).entries.filter(entry=>entry.enabled&&entry.safetyClass!=='HARD_BLOCKED').slice(0,20).map(entry=>({name:entry.appName,allowedActions:entry.allowedActions}));
  const bounded=(value:string)=>value.slice(0,250);
  return JSON.stringify({source:'USER_SUPPLIED_LOCAL_PROFILE',displayName:bounded(profile.displayName),company:bounded(profile.company),vehicleNumber:bounded(profile.vehicleNumber),preferredLanguage:profile.preferredLanguage,
    ...(/\b(telefon(?:ul)?|phone|nummer|email(?:ul)?|mail|adresa|address|adresse)\b/.test(normalized)?{phone:bounded(profile.phone),email:bounded(profile.email),address:bounded(profile.address)}:{}),applications,
    limitation:'App permissions are preferences, not proof of access to app contents or completed actions. No calendar or mailbox contents are included.'});
}
