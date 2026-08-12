import assert from 'node:assert/strict';
import { createPremiumAssistantClient, PremiumAssistantClientError } from '../src/premium-voice-shell/premium-assistant.client';

const request = { productId:'agm-cockpit' as const, moduleId:'required-document', language:'ro' as const, confirmedText:'Ce verific?', history:[] };
const missing = createPremiumAssistantClient({ apiBaseUrl:'/api/v1', fetch, sessionStorage:{ getItem:()=>null } });
await assert.rejects(() => missing.respond(request), (error) => error instanceof PremiumAssistantClientError && error.reason === 'authentication-required');

let sentBody: unknown;
const client = createPremiumAssistantClient({
  apiBaseUrl:'https://api.example/api/v1/', sessionStorage:{ getItem:()=> 'access-token' },
  fetch: (async (_url, init) => {
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ data:{ contractVersion:'premium-assistant.v1', kind:'answer', text:'Verifică valabilitatea.', provider:'openai', productId:'agm-cockpit', moduleId:'required-document', contextRefs:[], externalEffectPerformed:false } }), { status:200 });
  }) as typeof fetch,
});
const answer = await client.respond(request);
assert.equal(answer.externalEffectPerformed, false);
assert.deepEqual(sentBody, request);

const unsafe = createPremiumAssistantClient({ apiBaseUrl:'/api/v1', sessionStorage:{getItem:()=> 'token'}, fetch:(async()=>new Response(JSON.stringify({data:{...answer,externalEffectPerformed:true}}),{status:200})) as typeof fetch });
await assert.rejects(() => unsafe.respond(request), (error) => error instanceof PremiumAssistantClientError && error.reason === 'invalid-response');
console.log('Premium assistant client: auth/read-only/response validation PASS');

