// Pilot build prerequisite (Node + Python standard library):
// node apps/web/scripts/prepare-local-wake.mjs
// gradlew -p apps/web/android :app:assembleAssistantPilot
// Model-only Android tests: -PagmaTestBuildType=assistantPilot :app:connectedAssistantPilotAndroidTest
// These tests use synthetic fixtures and do not establish physical wake PASS.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '../android/app');
const cache = path.resolve(import.meta.dirname, '../../../.tmp/agma-wake');
await mkdir(cache, { recursive: true });
const dependencies = [
  { name:'sherpa-onnx-2.0.2.aar', url:'https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.2/sherpa-onnx-2.0.2.aar', sha256:'6420cfb86c2ef8462dadd77b2202b7430487bdfb2bc715e9ce2864871209a80e' },
  { name:'kws-model.tar.bz2', url:'https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01.tar.bz2', sha256:'f170013b4716e41b62b9bfd809687c207cef798ef9bc6534d524e17af9b6561a' },
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const item of dependencies) {
  const target = path.join(cache, item.name);
  let bytes;
  try { bytes = await readFile(target); } catch {}
  if (!bytes || digest(bytes) !== item.sha256) {
    const response = await fetch(item.url, { signal: AbortSignal.timeout(180000) });
    if (!response.ok) throw Error(`Download failed: ${item.name}: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (digest(bytes) !== item.sha256) throw Error(`Integrity mismatch: ${item.name}`);
    await writeFile(target, bytes);
  }
}
await mkdir(path.join(app, 'libs'), { recursive: true });
await copyFile(path.join(cache, dependencies[0].name), path.join(app, 'libs', dependencies[0].name));
// Python's built-in bz2 avoids installing an archive program. Only explicitly
// named regular files are read, and output paths are fixed within the pilot.
execFileSync('python', ['-c', `
import pathlib, sys, tarfile
out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
prefix='sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01/'
files={'encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx':'encoder.onnx','decoder-epoch-12-avg-2-chunk-16-left-64.onnx':'decoder.onnx','joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx':'joiner.onnx','tokens.txt':'tokens.txt'}
with tarfile.open(sys.argv[1], 'r:bz2') as archive:
 for source,target in files.items():
  member=archive.getmember(prefix+source)
  if not member.isfile(): raise ValueError('Expected regular model file')
  (out/target).write_bytes(archive.extractfile(member).read())
`, path.join(cache, dependencies[1].name), path.join(app, 'src/assistantPilot/assets/wakeword')], { stdio:'inherit' });
const assets = path.join(app, 'src/assistantPilot/assets/wakeword');
const tokens = new Set((await readFile(path.join(assets, 'tokens.txt'), 'utf8')).trim().split(/\r?\n/).map(line => line.split(' ')[0]));
for (const line of (await readFile(path.join(assets, 'keywords.txt'), 'utf8')).trim().split(/\r?\n/)) {
  for (const token of line.trim().split(/\s+/).filter(item => !/^[:#@]/.test(item))) if (!tokens.has(token)) throw Error(`Unknown keyword token: ${token}`);
}
console.log('Pinned Android wake dependencies and keyword tokens: PASS');
