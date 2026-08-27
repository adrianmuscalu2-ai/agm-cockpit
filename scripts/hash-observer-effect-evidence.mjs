import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const rootArgument = process.argv[2];
const verifyOnly = process.argv.includes('--verify');
if (!rootArgument) throw new Error('EVIDENCE_ROOT_REQUIRED');

const root = resolve(rootArgument);
const manifestName = 'SHA256SUMS.json';

async function collectFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    if (entry === manifestName) continue;
    const fullPath = join(directory, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) result.push(...await collectFiles(fullPath));
    else if (info.isFile()) result.push(fullPath);
  }
  return result;
}

async function hashFiles() {
  const entries = [];
  for (const file of (await collectFiles(root)).sort()) {
    const data = await readFile(file);
    entries.push({
      file: relative(root, file).replaceAll('\\', '/'),
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
    });
  }
  return entries;
}

const manifestPath = join(root, manifestName);
const current = await hashFiles();

if (verifyOnly) {
  const text = (await readFile(manifestPath, 'utf8')).replace(/^\uFEFF/, '');
  const manifest = JSON.parse(text);
  if (JSON.stringify(manifest.files) !== JSON.stringify(current)) {
    throw new Error('EVIDENCE_MANIFEST_MISMATCH');
  }
  console.log(`EVIDENCE MANIFEST VERIFIED - ${current.length} files`);
} else {
  const manifest = {
    contract: 'agm-instrumentation-observer-effect-evidence-hashes.v1',
    generatedAt: new Date().toISOString(),
    immutableAfterHash: true,
    files: current,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`EVIDENCE HASHED - ${current.length} files`);
}
