import assert from 'node:assert/strict';
import { createPremiumAssistantClient, PremiumAssistantClientError } from '../src/premium-voice-shell/premium-assistant.client';

const request = { productId:'agm-cockpit' as const, moduleId:'required-document', language:'ro' as const, confirmedText:'Ce verific?', history:[] };
const missing = createPremiumAssistantClient({ apiBaseUrl:'/api/v1', fetch, sessionStorage:{ getItem:()=>null } });
await assert.rejects(() => missing.respond(request), (error) => error instanceof PremiumAssistantClientError && error.reason === 'authentication-required');

let sentBody: unknown;
const sourceTrace = { traceId:'trace-1', status:'LIBRARY_ONLY' as const, generatedAt:'2026-09-12T12:00:00.000Z', counts:{total:1,library:1,cache:0,live:0} };
const client = createPremiumAssistantClient({
  apiBaseUrl:'https://api.example/api/v1/', sessionStorage:{ getItem:()=> 'access-token' },
  fetch: (async (url, init) => {
    if(String(url).includes('/premium-assistant/sources/')) return new Response(JSON.stringify({data:{...sourceTrace,sources:[{sourceId:'CS-1',title:'Tahograf',origin:'AGM Library',urlOrIdentifier:'AGM_LIBRARY/TACHO.md',timestamp:'2026-09-12T12:00:00.000Z',domain:['LEGISLATION_SAFETY'],language:'ro',confidence:.98,originType:'DOCUMENT_LIBRARY',retrievalType:'LIBRARY',freshness:{status:'CURRENT',checkedAt:'2026-09-12T12:00:00.000Z',expiresAt:'2026-09-19T12:00:00.000Z',ttlSeconds:604800},provenance:{canonicalPath:'AGM_LIBRARY/TACHO.md',sha256:'abc',authorityType:'AUTHORITATIVE',reviewStatus:'APPROVED'}}]}}),{status:200});
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ data:{ contractVersion:'premium-assistant.v2', kind:'answer', text:'Verifică valabilitatea.', provider:'openai', productId:'agm-cockpit', moduleId:'required-document', contextRefs:[], sourceTrace, cache:{disposition:'MISS',ttlSeconds:900}, timing:{timeToFirstTokenMs:120,orchestratorMs:4,modelMs:400,answerCompleteMs:404,serverTotalMs:410,sourceResolutionMs:2}, externalEffectPerformed:false } }), { status:200 });
  }) as typeof fetch,
});
const answer = await client.respond(request);
assert.equal(answer.externalEffectPerformed, false);
assert.deepEqual(sentBody, request);
const sources = await client.sources(answer.sourceTrace.traceId);
assert.equal(sources.sources.length, 1);
assert.equal(sources.sources[0]?.retrievalType, 'LIBRARY');

const unsafe = createPremiumAssistantClient({ apiBaseUrl:'/api/v1', sessionStorage:{getItem:()=> 'token'}, fetch:(async()=>new Response(JSON.stringify({data:{...answer,externalEffectPerformed:true}}),{status:200})) as typeof fetch });
await assert.rejects(() => unsafe.respond(request), (error) => error instanceof PremiumAssistantClientError && error.reason === 'invalid-response');
console.log('Premium assistant client: auth/read-only/v2 async source trace validation PASS');

