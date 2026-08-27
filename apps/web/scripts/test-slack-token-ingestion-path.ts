import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createSlackReadOnlyAdapter } from '../src/external-capabilities/slack-readonly.provider';

const dummy = 'xoxb-1234567890-ABCDEFGHIJKLMNOPQRSTUVWXYZ-9876543210';
assert.match(dummy, /^xoxb-[A-Za-z0-9-]+$/);
assert.equal([...dummy].every((character) => character.codePointAt(0)! <= 0x7f), true);

const child = spawnSync(
  process.execPath,
  ['-e', "const v=process.env.SLACK_BOT_TOKEN;if(!/^xoxb-[A-Za-z0-9-]+$/.test(v||''))process.exit(7);const h=new Headers({Authorization:'Bearer '+v});if(h.get('Authorization')!=='Bearer '+v)process.exit(8);process.stdout.write('RUNTIME_AND_HEADER_PASS')"],
  { env: { ...process.env, SLACK_BOT_TOKEN: dummy }, encoding: 'utf8' },
);
assert.equal(child.status, 0);
assert.equal(child.stdout, 'RUNTIME_AND_HEADER_PASS');
assert.equal(child.stderr, '');
assert.doesNotMatch(`${child.stdout}${child.stderr}`, /xoxb-/);

assert.doesNotThrow(() => createSlackReadOnlyAdapter(dummy));
for (const invalid of [
  'xoxb-123—456',
  '“xoxb-123-456”',
  'xoxb-123-456\r\n',
  ' xoxb-123-456',
  'xoxb-123-456 ',
  'xoxa-123-456',
]) {
  assert.throws(() => createSlackReadOnlyAdapter(invalid), /SLACK_BOT_TOKEN_FORMAT_REJECTED/);
}

console.log('SLACK TOKEN INGESTION PATH - PASS / READY FOR REAL TOKEN');
