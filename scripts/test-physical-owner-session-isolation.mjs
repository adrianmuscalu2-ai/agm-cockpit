import { readFile } from 'node:fs/promises';
import { rejectAuthMockingOnOwnerDevice, OWNER_ANDROID_SERIAL } from './physical-owner-session-policy.mjs';

const legacyRunners = [
  'scripts/validate-agma-wave2a-slice1-android.mjs',
  'scripts/validate-agma-wave2b-android.mjs',
  'scripts/validate-agma-wave2c-android.mjs',
];

for (const runner of legacyRunners) {
  const source = await readFile(runner, 'utf8');
  if (!source.includes('rejectAuthMockingOnOwnerDevice')) {
    throw new Error(`${runner}: owner-device guard missing`);
  }
}

let blocked = false;
try {
  rejectAuthMockingOnOwnerDevice({ runner: 'policy-self-test', serial: OWNER_ANDROID_SERIAL });
} catch (error) {
  blocked = String(error).includes('BLOCKED');
}
if (!blocked) throw new Error('Owner-device auth mock was not blocked');

const sessionRunner = await readFile('scripts/validate-agma-wave2c-android-session.mjs', 'utf8');
for (const forbidden of ['page.route(', 'addInitScript(', "sessionStorage.setItem('agm.auth.accessToken'"]) {
  if (sessionRunner.includes(forbidden)) throw new Error(`Session runner contains forbidden interception: ${forbidden}`);
}
for (const required of ['REAL OWNER SESSION / NO AUTH OR API MOCKS', "'forward','--remove','tcp:9222'"]) {
  if (!sessionRunner.includes(required)) throw new Error(`Session runner cleanup/isolation marker missing: ${required}`);
}

console.log('PHYSICAL OWNER SESSION ISOLATION: PASS');
