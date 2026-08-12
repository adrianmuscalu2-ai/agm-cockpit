import assert from 'node:assert/strict';
import { enforceVerifiedContactBoundary } from '../src/premium-voice-shell/premium-assistant-grounding';
const fabricated='Abschleppdienst Heilbronn: +49 7131 123456 (example)';
for(const language of ['ro','de','en','fr','nl','ru','pl','tr','sq'] as const){const result=enforceVerifiedContactBoundary('Am nevoie de un număr pentru tractare în Heilbronn',fabricated,language);assert.doesNotMatch(result,/123456|Abschleppdienst/);assert.ok(result.length>20);}
assert.equal(enforceVerifiedContactBoundary('Cum verific documentul?','Verifică data.', 'ro'),'Verifică data.');
console.log('Premium assistant verified-contact fail-closed boundary 9/9: PASS');
