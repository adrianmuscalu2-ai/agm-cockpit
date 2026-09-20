import assert from 'node:assert/strict';
import { createPremiumAssistantClient, PremiumAssistantClientError } from '../src/premium-voice-shell/premium-assistant.client';
import { premiumAssistantFailureMessage } from '../src/premium-voice-shell/premium-assistant-failure';

const request = { productId:'agm-cockpit' as const, moduleId:'required-document', language:'ro' as const, confirmedText:'Ce verific?', history:[] };
let missingRefreshCalls = 0;
const missing = createPremiumAssistantClient({
  apiBaseUrl:'/api/v1',
  fetch:(async (url) => { assert.ok(String(url).endsWith('/auth/refresh')); missingRefreshCalls += 1; return new Response('{}', {status:401}); }) as typeof fetch,
  sessionStorage:{ getItem:()=>null },
});
await assert.rejects(() => missing.respond(request), (error) => error instanceof PremiumAssistantClientError && error.reason === 'authentication-required');
assert.equal(missingRefreshCalls, 1);

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

const legacyCompatible = createPremiumAssistantClient({
  apiBaseUrl:'/api/v1', sessionStorage:{getItem:()=> 'token'},
  fetch:(async()=>new Response(JSON.stringify({data:{...answer,contractVersion:'premium-assistant.v1'}}),{status:200})) as typeof fetch,
});
await assert.doesNotReject(() => legacyCompatible.respond(request));

const renewalMemory = new Map<string, string>([['agm.auth.accessToken', 'expired-token']]);
const renewalRequests: Array<{url:string;authorization:string|null}> = [];
let protectedAttempts = 0;
const renewalClient = createPremiumAssistantClient({
  apiBaseUrl:'https://api.example/api/v1',
  sessionStorage:{
    getItem:key=>renewalMemory.get(key)??null,
    setItem:(key,value)=>void renewalMemory.set(key,value),
    removeItem:key=>void renewalMemory.delete(key),
  },
  fetch:(async (url, init) => {
    const authorization = new Headers(init?.headers).get('Authorization');
    renewalRequests.push({url:String(url), authorization});
    if(String(url).endsWith('/auth/refresh')) return new Response(JSON.stringify({data:{accessToken:'renewed-token'}}),{status:200});
    protectedAttempts += 1;
    if(protectedAttempts===1) return new Response('{}',{status:401});
    return new Response(JSON.stringify({data:answer}),{status:200});
  }) as typeof fetch,
});
await assert.doesNotReject(()=>renewalClient.respond(request));
assert.deepEqual(renewalRequests.map(item=>item.url),[
  'https://api.example/api/v1/premium-assistant/respond',
  'https://api.example/api/v1/auth/refresh',
  'https://api.example/api/v1/premium-assistant/respond',
]);
assert.equal(renewalRequests[0]?.authorization,'Bearer expired-token');
assert.equal(renewalRequests[2]?.authorization,'Bearer renewed-token');
assert.equal(renewalMemory.get('agm.auth.accessToken'),'renewed-token');

const coldSessionMemory = new Map<string, string>();
const coldSessionRequests: string[] = [];
const coldSessionClient = createPremiumAssistantClient({
  apiBaseUrl:'https://api.example/api/v1',
  sessionStorage:{
    getItem:key=>coldSessionMemory.get(key)??null,
    setItem:(key,value)=>void coldSessionMemory.set(key,value),
    removeItem:key=>void coldSessionMemory.delete(key),
  },
  fetch:(async (url) => {
    coldSessionRequests.push(String(url));
    if(String(url).endsWith('/auth/refresh')) return new Response(JSON.stringify({data:{accessToken:'cold-session-renewed-token'}}),{status:200});
    return new Response(JSON.stringify({data:answer}),{status:200});
  }) as typeof fetch,
});
await assert.doesNotReject(()=>coldSessionClient.respond(request));
assert.deepEqual(coldSessionRequests,[
  'https://api.example/api/v1/auth/refresh',
  'https://api.example/api/v1/premium-assistant/respond',
]);
assert.equal(coldSessionMemory.get('agm.auth.accessToken'),'cold-session-renewed-token');

assert.match(premiumAssistantFailureMessage('authentication-required','ro'),/Sesiunea AGM/);
assert.match(premiumAssistantFailureMessage('authentication-required','ro'),/Datele personale nu au fost consultate/);
assert.match(premiumAssistantFailureMessage('provider-unavailable','ro'),/resolverul autorizat/);
assert.doesNotMatch(premiumAssistantFailureMessage('provider-unavailable','ro'),/nu poate răspunde momentan/i);

const unsafe = createPremiumAssistantClient({ apiBaseUrl:'/api/v1', sessionStorage:{getItem:()=> 'token'}, fetch:(async()=>new Response(JSON.stringify({data:{...answer,externalEffectPerformed:true}}),{status:200})) as typeof fetch });
await assert.rejects(() => unsafe.respond(request), (error) => error instanceof PremiumAssistantClientError && error.reason === 'invalid-response');
console.log('Premium assistant client: automatic session renewal, auth/read-only/v1+v2 compatibility and async source trace validation PASS');

