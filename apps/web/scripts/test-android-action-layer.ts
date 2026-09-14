import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { routeAndroidAction, routeRetrievedAndroidAction } from '../src/android-action-layer/android-action.router';
import { androidActionSafetyBoundary, confirmationFor } from '../src/android-action-layer/confirmation-policy';
import type { ActiveDriverContext } from '../src/android-action-layer/android-action.contract';

const context: ActiveDriverContext = {
  contractVersion:'gmail-action-context.v1',traceId:'trace-1',messageRef:'GMAIL-hash',senderEmail:'dispatch@example.com',subject:'Descărcare Heilbronn',receivedAt:'2026-09-13T08:00:00.000Z',
  destinations:['Industriestrasse 10, 74072 Heilbronn'],phoneNumbers:['+49 7131 123456'],dateTimes:['2026-09-14T06:30:00.000Z'],shareText:'Descărcare la Industriestrasse 10',answerText:'Ultimul mail confirmă descărcarea în Heilbronn.',capturedAtEpochMs:1,expiresAtEpochMs:Number.MAX_SAFE_INTEGER,
};

const navigate = routeAndroidAction('Navighează acolo.', context);
assert.equal(navigate.status, 'RESOLVED');
assert.equal(navigate.action, 'NAVIGATION');
assert.equal(navigate.source, 'ACTIVE_GMAIL_CONTEXT');
assert.equal(navigate.payload?.value, context.destinations[0]);

const gmailNavigation = routeRetrievedAndroidAction('Citește ultimul mail de la dispecerat și deschide adresa de descărcare.', context);
assert.equal(gmailNavigation?.status, 'RESOLVED');
assert.equal(gmailNavigation?.action, 'NAVIGATION');
assert.equal(gmailNavigation?.payload?.value, context.destinations[0]);

const dial = routeAndroidAction('Sună numărul.', context);
assert.equal(dial.action, 'DIAL');
assert.equal(dial.payload?.value, context.phoneNumbers[0]);

const reply = routeAndroidAction('Răspunde că ajung în 30 de minute.', context);
assert.equal(reply.action, 'EMAIL_DRAFT');
assert.equal(reply.payload?.value, 'dispatch@example.com');
assert.match(reply.payload?.contextText ?? '', /30 de minute/);
assert.equal(reply.confirmation, 'ANDROID_TARGET');

const calendar = routeAndroidAction('Adaugă asta în calendar.', context);
assert.equal(calendar.action, 'CALENDAR');
assert.equal(calendar.payload?.startEpochMs, Date.parse(context.dateTimes[0]!));

const missing = routeAndroidAction('Navighează acolo.', null);
assert.equal(missing.status, 'CLARIFICATION_REQUIRED');
const unsupported = routeAndroidAction('Șterge toate fișierele.', context);
assert.equal(unsupported.status, 'UNSUPPORTED');
assert.equal(unsupported.reason, 'ACTION_NOT_ALLOWLISTED');
assert.equal(confirmationFor('SHARE'), 'AGM_REQUIRED');
assert.deepEqual(androidActionSafetyBoundary, {
  autoSendEmail:false,directPhoneCall:false,directCalendarWrite:false,arbitraryUiAutomation:false,accessibilityService:false,finalExternalCommit:'ANDROID_TARGET_REQUIRES_USER_ACTION',
});

const root = resolve(import.meta.dirname, '../../..');
const native = readFileSync(resolve(root, 'apps/web/android/app/src/main/java/com/agm/cockpit/DeviceHandoffIntents.java'), 'utf8');
const manifest = readFileSync(resolve(root, 'apps/web/android/app/src/main/AndroidManifest.xml'), 'utf8');
const executor = readFileSync(resolve(root, 'apps/web/src/android-action-layer/android-action.executor.ts'), 'utf8');
assert.match(native, /Intent\.ACTION_ASSIST/);
assert.match(native, /Intent\.ACTION_DIAL/);
assert.match(native, /CalendarContract\.Events\.CONTENT_URI/);
assert.match(native, /Intent\.createChooser/);
assert.match(native, /Intent\.ACTION_SENDTO/);
assert.doesNotMatch(native, /ACTION_CALL|AccessibilityService|com\.google|com\.waze|com\.tomtom/);
assert.doesNotMatch(manifest, /CALL_PHONE|READ_CALENDAR|WRITE_CALENDAR|READ_CONTACTS|QUERY_ALL_PACKAGES|BIND_ACCESSIBILITY_SERVICE/);
assert.match(executor, /resolution\.source === 'ACTIVE_GMAIL_CONTEXT'[\s\S]*\? 'USER_TEXT' : 'PUBLIC'/);

console.log('ANDROID ACTION LAYER PROTOCOL: PASS');
