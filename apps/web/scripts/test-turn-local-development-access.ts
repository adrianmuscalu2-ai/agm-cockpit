import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync(new URL('../src/admin-auth.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

assert.doesNotMatch(auth, /localAdministratorBypassActive|open-pre-release|agm-local-development-access/);
assert.doesNotMatch(main, /PIN dezactivat până la pregătirea lansării/);
assert.doesNotMatch(main, /localStorage\.setItem\(ADMIN_SESSION_KEY/);
assert.match(auth, /sessionStorage\?\.setItem\(ADMIN_SESSION_KEY/);
assert.match(auth, /localStorage\?\.removeItem\(ADMIN_SESSION_KEY/);
assert.match(auth, /turn-admin\/refresh/);
assert.match(auth, /credentials: 'include'/);

console.log('Turn administrative access has no bypass or persistent JWT: PASS');
