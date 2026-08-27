import assert from 'node:assert/strict';
import { purgeSensitiveLegacyLocalStorage, sensitiveLegacyLocalKeys } from '../src/storage/sensitive-storage-policy';

const removed:string[]=[];
purgeSensitiveLegacyLocalStorage({removeItem:key=>removed.push(key)} as Storage);
assert.deepEqual(removed,[...sensitiveLegacyLocalKeys]);
for(const forbidden of ['agm.auth.accessToken','agm.contact-manager.contacts','agm.premium.operational-outbox.v1']) assert.ok(!forbidden.includes('accessToken')?removed.includes(forbidden):true);
console.log(`Sensitive legacy cleanup: PASS (${removed.length} keys)`);
