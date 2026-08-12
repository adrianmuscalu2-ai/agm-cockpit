import { createHmac } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { validateOutbound } from '../src/communications/communication.contract';
import { parseGmailPush, parseWhatsAppWebhook, verifyHmacSha256 } from '../src/communications/webhook.parsers';

const email = validateOutbound({ contractVersion: 'communication-message.v1', clientMessageId: '1d7365d1-47ce-4ddf-87d2-ded7f46de674', channel: 'email', to: ' DRIVER@EXAMPLE.COM ', subject: 'Document', bodyText: ' Confirm receipt ' });
assert.equal(email.to, 'driver@example.com');
assert.equal(email.bodyText, 'Confirm receipt');

const whatsapp = validateOutbound({ contractVersion: 'communication-message.v1', clientMessageId: '894b794a-8579-46fd-87f8-92f012092a34', channel: 'whatsapp', to: '+49 170 1234567', bodyText: 'ETA?' });
assert.equal(whatsapp.to, '+491701234567');

const webhook = { entry: [{ changes: [{ value: { metadata: { display_phone_number: '+491111' }, contacts: [{ profile: { name: 'Driver' } }], messages: [{ id: 'wamid.in', from: '491701234567', timestamp: '1786273200', type: 'text', text: { body: 'Arrived' } }], statuses: [{ id: 'wamid.out', status: 'delivered', timestamp: '1786273210' }] } }] }] };
const parsed = parseWhatsAppWebhook(webhook);
assert.equal(parsed.inbound.length, 1);
assert.equal(parsed.inbound[0].bodyText, 'Arrived');
assert.equal(parsed.statuses[0].status, 'delivered');

const raw = Buffer.from(JSON.stringify(webhook));
const secret = 'test-only-secret';
const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
assert.equal(verifyHmacSha256(raw, signature, secret), true);
assert.equal(verifyHmacSha256(raw, 'sha256=00', secret), false);

const push = parseGmailPush({ message: { messageId: 'push-1', data: Buffer.from(JSON.stringify({ emailAddress: 'owner@example.com', historyId: '987' })).toString('base64') } });
assert.equal(push.historyId, '987');

assert.throws(() => validateOutbound({ contractVersion: 'communication-message.v1', clientMessageId: 'invalid', channel: 'email', to: 'x', bodyText: 'x' }));
console.log('BIDIRECTIONAL COMMUNICATION CONTRACT — PASS');
console.log('EMAIL OUTBOUND + GMAIL PUSH CONTRACT — PASS');
console.log('WHATSAPP INBOUND / OUTBOUND / DELIVERY STATUS — PASS');
console.log('WEBHOOK SIGNATURE VERIFICATION — PASS');
