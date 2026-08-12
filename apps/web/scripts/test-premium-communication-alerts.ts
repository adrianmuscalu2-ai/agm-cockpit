import assert from 'node:assert/strict';
import { applyVerifiedMessageEvent, initialAlertState } from '../src/premium-copilot/communication-alert.contract';

const disconnected = initialAlertState('email', 'DISCONNECTED');
assert.equal(applyVerifiedMessageEvent(disconnected, { eventId: 'e1', channel: 'email', providerMessageId: 'm1', receivedAt: new Date().toISOString() }).unreadCount, 0);
const connected = initialAlertState('email', 'CONNECTED');
assert.equal(applyVerifiedMessageEvent(connected, { eventId: 'e1', channel: 'whatsapp', providerMessageId: 'm1', receivedAt: new Date().toISOString() }).unreadCount, 0);
assert.equal(applyVerifiedMessageEvent(connected, { eventId: '', channel: 'email', providerMessageId: '', receivedAt: new Date().toISOString() }).unreadCount, 0);
assert.equal(applyVerifiedMessageEvent(connected, { eventId: 'e1', channel: 'email', providerMessageId: 'm1', receivedAt: new Date().toISOString() }).unreadCount, 1);
console.log('Premium communication alert foundation: PASS (fail-closed; verified provider events only)');
