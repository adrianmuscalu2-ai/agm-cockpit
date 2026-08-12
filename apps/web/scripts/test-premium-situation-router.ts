import assert from 'node:assert/strict';
import { basicLanguageCodes } from '../src/language-registry';
import { classifyDocumentExpiry, createOperationalCase, transitionOperationalCase } from '../src/premium-situation-router/operational-case.machine';
import { LEGACY_PRE_DEPARTURE_KEY, migrateLegacyRequiredDocument, migrationMarker, restoreOperationalCase, saveOperationalCase } from '../src/premium-situation-router/operational-case.persistence';
import { authorizedSituationRegistry, executableSituationIds } from '../src/premium-situation-router/situation.registry';

assert.deepEqual(executableSituationIds.slice(0,2), ['required-document','road-control']);
assert.equal(Object.keys(authorizedSituationRegistry).length, 24);

const blockedSafety = transitionOperationalCase(createOperationalCase('road-1','road-control','ro'), { type:'CONFIRM_SAFE_INTERACTION', safe:false });
assert.equal(blockedSafety.activeStep, 'safe-interaction');
assert.equal(transitionOperationalCase(blockedSafety,{type:'ADVANCE'}), blockedSafety);

let road = transitionOperationalCase(createOperationalCase('road-2','road-control','de'), { type:'CONFIRM_SAFE_INTERACTION', safe:true });
road = transitionOperationalCase(road,{type:'CONFIRM_SAFE_STOP'});
assert.equal(road.activeStep,'qualify-request');
road = transitionOperationalCase(road,{type:'PREPARE_EXTERNAL',effect:{operationId:'op-1',channel:'email'}});
assert.equal(road.externalEffects[0].phase,'PREPARED');
assert.equal(transitionOperationalCase(road,{type:'MARK_SENT',operationId:'op-1'}),road);
road = transitionOperationalCase(road,{type:'CONFIRM_EXTERNAL',operationId:'op-1'});
road = transitionOperationalCase(road,{type:'MARK_SENT',operationId:'op-1'});
road = transitionOperationalCase(road,{type:'RECORD_RECEIPT',operationId:'op-1',receipt:'receipt-redacted'});
const receiptRevision = road.revision;
road = transitionOperationalCase(road,{type:'PREPARE_EXTERNAL',effect:{operationId:'op-1',channel:'email'}});
road = transitionOperationalCase(road,{type:'MARK_SENT',operationId:'op-1'});
assert.equal(road.revision,receiptRevision);
assert.equal(road.externalEffects.length,1);

let documentCase = createOperationalCase('doc-1','required-document','fr');
documentCase = transitionOperationalCase(documentCase,{type:'ADD_EVIDENCE',evidence:{id:'ocr-1',sha256:'ocr-hash',kind:'ocr-proposal'}});
assert.equal(documentCase.evidence.length,0);
documentCase = transitionOperationalCase(documentCase,{type:'ADD_EVIDENCE',evidence:{id:'original-1',sha256:'original-1',kind:'original'}});
documentCase = transitionOperationalCase(documentCase,{type:'ADD_EVIDENCE',evidence:{id:'ocr-1',sha256:'ocr-hash',kind:'ocr-proposal',sourceId:'original-1',sourceSha256:'original-1',initialText:'CMR'}});
assert.equal(documentCase.state,'REVIEW_REQUIRED');
const refusedReady = transitionOperationalCase(documentCase,{type:'CONFIRM_READY'});
assert.equal(refusedReady,documentCase);
documentCase = transitionOperationalCase(documentCase,{type:'SET_DATA',values:{textConfirmed:true,readable:true,validUntil:'2027-12-31',severity:'warning'}});
documentCase = transitionOperationalCase(documentCase,{type:'ADD_EVIDENCE',evidence:{id:'confirm-1',sha256:'confirmed-hash',kind:'human-confirmation',sourceId:'ocr-1',sourceSha256:'ocr-hash',confirmedText:'CMR corrected',confirmedAt:'2026-08-10T00:00:00.000Z',confirmedBy:'owner'}});
documentCase = transitionOperationalCase(documentCase,{type:'CONFIRM_READY'});
assert.equal(documentCase.state,'RESOLVED');
assert.equal(classifyDocumentExpiry('2026-08-09',new Date('2026-08-10T00:00:00Z')),'EXPIRED');
assert.equal(classifyDocumentExpiry('2026-08-30',new Date('2026-08-10T00:00:00Z')),'WARNING');
assert.equal(classifyDocumentExpiry('2027-08-30',new Date('2026-08-10T00:00:00Z')),'VALID');

const memory = new Map<string,string>();
const storage = { getItem:(key:string)=>memory.get(key) ?? null, setItem:(key:string,value:string)=>void memory.set(key,value) };
saveOperationalCase(storage as Storage,documentCase);
assert.deepEqual(restoreOperationalCase(storage as Storage),documentCase);
assert.equal(migrationMarker('{"legacy":true}'),migrationMarker('{"legacy":true}'));
memory.clear();
const legacy=JSON.stringify({contexts:['local'],answers:{documents:{status:'problem'}},issues:{issue1:{severity:'critical'}},confirmation:null});
memory.set(LEGACY_PRE_DEPARTURE_KEY,legacy);
const migrated=migrateLegacyRequiredDocument(storage as Storage,{caseId:'legacy-case',tripId:'trip-1',documentType:'cmr',language:'ro'})!;
assert.deepEqual(migrated.data.legacyAnswers,{documents:{status:'problem'}});
assert.deepEqual(migrated.data.legacyIssues,{issue1:{severity:'critical'}});
const repeated=migrateLegacyRequiredDocument(storage as Storage,{caseId:'different',tripId:'trip-1',documentType:'cmr',language:'ro'})!;
assert.equal(repeated.id,'legacy-case');
assert.equal(memory.get(LEGACY_PRE_DEPARTURE_KEY),legacy);
memory.clear(); memory.set(LEGACY_PRE_DEPARTURE_KEY,legacy);
assert.equal(migrateLegacyRequiredDocument(storage as Storage)?.state,'RECOVERY_REQUIRED');

assert.deepEqual(basicLanguageCodes,['ro','de','en','fr','nl','ru','pl','tr','sq']);
for (const language of basicLanguageCodes) assert.equal(createOperationalCase(`case-${language}`,'required-document',language).language,language);

console.log('Premium dynamic situation router — authorized slices domain/state/recovery/dedup/i18n contract: PASS');
