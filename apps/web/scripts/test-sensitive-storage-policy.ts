import assert from 'node:assert/strict';
import { purgeSensitiveLegacyLocalStorage, sensitiveLegacyLocalKeys } from '../src/storage/sensitive-storage-policy';

const removed:string[]=[];
purgeSensitiveLegacyLocalStorage({removeItem:key=>removed.push(key)} as Storage);
assert.deepEqual(removed,[...sensitiveLegacyLocalKeys]);
for(const forbidden of ['agm.premium.operational-outbox.v1']) assert.ok(removed.includes(forbidden));
assert.ok(!removed.includes('agm.contact-manager.contacts'), 'User-managed Quick Contacts must survive an app restart until explicit deletion/reset.');
console.log(`Sensitive legacy cleanup: PASS (${removed.length} keys)`);
