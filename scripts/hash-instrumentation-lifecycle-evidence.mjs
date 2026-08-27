import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const rootArgument = process.argv[2];
const verifyOnly = process.argv.includes('--verify');
if (!rootArgument) throw new Error('EVIDENCE_ROOT_REQUIRED');

const root = resolve(rootArgument);
const manifestName = 'SHA256SUMS.json';
const manifestContract = 'agm-instrumentation-lifecycle-closure-evidence-hashes.v1';
const validRelativePath = (value) => typeof value === 'string'
  && value.length > 0
  && !isAbsolute(value)
  && !value.includes('\\')
  && !value.includes('\0')
  && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
const isWithin = (parent, child) => {
  const path = relative(resolve(parent), resolve(child));
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
};

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory)) {
    if (directory === root && entry === manifestName) continue;
    const fullPath = join(directory, entry);
    const linkInfo = await lstat(fullPath);
    if (linkInfo.isSymbolicLink()) throw new Error(`EVIDENCE_LINK_REJECTED:${relative(root, fullPath)}`);
    const info = await stat(fullPath);
    if (info.isDirectory()) files.push(...await collect(fullPath));
    else if (info.isFile()) files.push(fullPath);
  }
  return files;
}

async function snapshot() {
  const entries = [];
  for (const file of (await collect(root)).sort()) {
    const bytes = await readFile(file);
    entries.push({
      file: relative(root, file).replaceAll('\\', '/'),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return entries;
}

const manifestPath = join(root, manifestName);
const files = await snapshot();

if (verifyOnly) {
  const manifest = JSON.parse((await readFile(manifestPath, 'utf8')).replace(/^\uFEFF/, ''));
  if (manifest.contract !== manifestContract || manifest.immutableAfterHash !== true
    || typeof manifest.generatedAt !== 'string' || !Number.isFinite(Date.parse(manifest.generatedAt))
    || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('EVIDENCE_MANIFEST_CONTRACT_INVALID');
  }
  const declaredPaths = manifest.files.map((entry) => entry?.file);
  if (new Set(declaredPaths).size !== declaredPaths.length
    || manifest.files.some((entry) => !validRelativePath(entry?.file)
      || !Number.isSafeInteger(entry?.bytes) || entry.bytes < 0
      || typeof entry?.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256))) {
    throw new Error('EVIDENCE_MANIFEST_ENTRY_INVALID');
  }
  if (declaredPaths.some((value, index) => index > 0 && String(declaredPaths[index - 1]) > String(value))) {
    throw new Error('EVIDENCE_MANIFEST_ORDER_INVALID');
  }
  const canonicalRoot = await realpath(root);
  for (const entry of manifest.files) {
    const target = resolve(root, ...entry.file.split('/'));
    if (!isWithin(root, target) || !isWithin(canonicalRoot, await realpath(target))) {
      throw new Error(`EVIDENCE_MANIFEST_PATH_ESCAPE:${entry.file}`);
    }
  }
  if (JSON.stringify(manifest.files) !== JSON.stringify(files)) {
    throw new Error('EVIDENCE_MANIFEST_MISMATCH');
  }
  console.log(`LIFECYCLE EVIDENCE MANIFEST VERIFIED - ${files.length} files`);
} else {
  const manifest = {
    contract: manifestContract,
    generatedAt: new Date().toISOString(),
    immutableAfterHash: true,
    files,
  };
  // A frozen evidence root can only be verified. Never overwrite its manifest
  // and silently establish a new integrity baseline after evidence changes.
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  console.log(`LIFECYCLE EVIDENCE HASHED - ${files.length} files`);
}
