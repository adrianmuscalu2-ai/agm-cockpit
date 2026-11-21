import { executeAndroidAction } from '../src/android-action-layer/android-action.executor';
import { resolveProfileApplicationCommand } from '../src/application-access/application-access.command';
import { profileConversationContext } from '../src/application-access/profile-conversation-context';
import { saveProfile, defaultProfile } from '../src/profileSettings';
import assert from 'node:assert/strict';
import { classifyApplication, discoveredApplication, evaluateApplicationAction, normalizeEntry } from '../src/application-access/application-access.policy';
import { normalizeApplicationAccess, readApplicationAccess, saveApplicationAccess } from '../src/application-access/application-access.storage';

const unknown = discoveredApplication({ appName: 'Unknown Tool', packageName: 'com.example.tool' });
assert.equal(unknown.state, 'OFF');
assert.equal(evaluateApplicationAction(unknown, 'OPEN_APP').result, 'DENY_USER');

const enabled = normalizeEntry({ ...unknown, enabled: true, allowedActions: ['OPEN_APP'], permissionState: 'GRANTED' });
assert.equal(evaluateApplicationAction(enabled, 'OPEN_APP').result, 'ALLOW');
assert.equal(evaluateApplicationAction(enabled, 'SEND_CONTENT').result, 'DENY_USER');
assert.equal(evaluateApplicationAction({ ...enabled, allowedActions: ['OPEN_APP', 'OPEN_DEEP_LINK'] }, 'OPEN_DEEP_LINK').result, 'ALLOW');
assert.equal(evaluateApplicationAction({ ...enabled, allowedActions: ['OPEN_APP'] }, 'OPEN_DEEP_LINK').result, 'DENY_USER');
assert.equal(evaluateApplicationAction({ ...enabled, permissionState: 'REQUIRED' }, 'OPEN_APP').result, 'PERMISSION_REQUIRED');
assert.equal(evaluateApplicationAction({ ...enabled, availability: 'UNAVAILABLE' }, 'OPEN_APP').result, 'UNAVAILABLE');
assert.equal(evaluateApplicationAction({ ...enabled, enabled: false, state: 'OFF' }, 'OPEN_APP').result, 'DENY_USER');

for (const app of [
  ['Banking', 'com.bank.mobile'], ['Wallet', 'com.crypto.wallet'], ['Authenticator', 'com.authenticator.app'], ['Password Manager', 'com.password.manager'],
]) {
  const entry = discoveredApplication({ appName: app[0], packageName: app[1] });
  assert.equal(entry.state, 'BLOCKED_BY_POLICY');
  assert.equal(evaluateApplicationAction(entry, 'OPEN_APP').result, 'DENY_POLICY');
}

const game = normalizeEntry({ appName: 'Example Game', packageName: 'com.example.game', enabled: true, allowedActions: ['OPEN_APP'], permissionState: 'GRANTED' });
assert.equal(evaluateApplicationAction(game, 'OPEN_APP', { driverSafetyMode: 'RESTRICTED' }).result, 'DENY_DRIVER_SAFETY');
const media = normalizeEntry({ appName: 'Example Media', packageName: 'com.example.media', enabled: true, allowedActions: ['MEDIA_PAUSE'], permissionState: 'GRANTED' });
assert.equal(evaluateApplicationAction(media, 'MEDIA_PAUSE', { driverSafetyMode: 'RESTRICTED' }).result, 'ALLOW');

assert.equal(classifyApplication('Maps', 'com.google.android.apps.maps'), 'NAVIGATION');
assert.equal(normalizeApplicationAccess({ entries: [{ ...enabled, allowedActions: ['NOT_REAL'] }] }).entries[0]?.allowedActions.length, 0);
const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
saveApplicationAccess(storage, { schemaVersion: 1, driverSafetyMode: 'NORMAL', entries: [enabled] });
assert.equal(readApplicationAccess(storage).entries[0]?.allowedActions[0], 'OPEN_APP');
console.log('Application access policy matrix: PASS');

assert.equal(evaluateApplicationAction(normalizeEntry({...enabled,sensitive:true}),'OPEN_APP').result,'DENY_POLICY');
assert.equal(normalizeApplicationAccess({entries:[null,0,enabled]}).entries.length,1);
assert.equal(resolveProfileApplicationCommand('Deschide Unknown Tool',storage)?.payload?.value,'com.example.tool');
assert.equal(resolveProfileApplicationCommand('Nu deschide Unknown Tool',storage),null);
saveProfile(storage,{...defaultProfile(),displayName:'Demo',company:'Example',phone:'123',defaultSignature:'PRIVATE SIGNATURE'});
const context=profileConversationContext('Ce firma am in profil?',storage,storage)!;
assert.match(context,/Example/);assert.equal(context.includes('PRIVATE SIGNATURE'),false);assert.equal(context.includes('123'),false);
assert.equal(profileConversationContext('Salut',storage,storage),undefined);
assert.match(profileConversationContext('Care este telefonul meu?',storage,storage)!,/123/);
console.log('Profile lookup, app command and sensitive override: PASS');

(async()=>{
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
 saveApplicationAccess(storage,{schemaVersion:1,driverSafetyMode:'NORMAL',entries:[{...enabled,enabled:false}]});
 const denied=await executeAndroidAction('Open Unknown Tool',resolveProfileApplicationCommand('Open Unknown Tool',storage)!);
 assert.equal(denied.result,'AUTH_PERMISSION_FAILURE');
 assert.equal(denied.fallback,'PROFILE_ACCESS_NOT_ENABLED');
 console.log('Disabled application blocked before native handoff: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
