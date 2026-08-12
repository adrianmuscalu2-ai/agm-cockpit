import { strict as assert } from 'node:assert';
import { CommunicationClient } from '../src/premium-communications/communication.client';

const calls: Array<{ url: string; init?: RequestInit }> = [];
const timeline: unknown[] = [];
const request = async (input: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(input), init });
  return new Response(JSON.stringify({ data: { id: 'message-1', channel: 'whatsapp', direction: 'outbound', status: 'sent', to: '+491701234567', bodyText: 'ETA?', tripId: 'trip-1', occurredAt: '2026-08-09T12:00:00.000Z' } }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const client = new CommunicationClient('https://api.example.test', () => 'opaque-token', (event) => { timeline.push(event); }, request as typeof fetch);
const sent = await client.send({ channel: 'whatsapp', to: '+491701234567', bodyText: 'ETA?', tripId: 'trip-1' });
assert.equal(sent.status, 'sent');
assert.equal(calls[0].url, 'https://api.example.test/communications/messages');
assert.match(String((calls[0].init?.headers as Record<string,string>).authorization), /^Bearer /);
assert.equal(timeline.length, 1);
await client.conversations('email');
assert.equal(calls[1].url, 'https://api.example.test/communications/conversations?channel=email');
await client.retry('message-1');
assert.equal(calls[2].url, 'https://api.example.test/communications/messages/message-1/retry');
console.log('PREMIUM EMAIL / WHATSAPP CLIENT — PASS');
console.log('TRIP TIMELINE ADAPTER — PASS');
