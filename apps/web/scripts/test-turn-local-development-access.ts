import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync(new URL('../src/admin-auth.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

assert.match(auth, /import\.meta\.env\.DEV && localHostname/);
assert.match(auth, /\['127\.0\.0\.1', 'localhost'\]/);
assert.match(main, /adminAccessVerified: localAdministratorBypassActive/);
assert.match(main, /PIN dezactivat până la pregătirea lansării/);
assert.doesNotMatch(auth, /import\.meta\.env\.PROD.*bypass/i);

console.log('Turn local development access contract: PASS');
