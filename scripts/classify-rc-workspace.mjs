import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const websiteRoot = join(root, 'agmcockpit-website');
const largeArtifactBytes = 10 * 1024 * 1024;

function git(args, cwd = root) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function parseStatus(output, repo = 'root') {
  const tokens = output.split('\0');
  const items = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const status = token.slice(0, 2);
    const path = token.slice(3).replaceAll('\\', '/');
    const item = { repo, status, path };
    if (status.includes('R') || status.includes('C')) {
      item.previousPath = tokens[index + 1]?.replaceAll('\\', '/') ?? null;
      index += 1;
    }
    items.push(item);
  }
  return items;
}

function fileMetadata(base, path) {
  const absolute = join(base, path);
  if (!existsSync(absolute)) {
    return { exists: false, bytes: 0, sha256: null };
  }
  const stat = lstatSync(absolute);
  if (!stat.isFile()) {
    return { exists: true, bytes: 0, sha256: null };
  }
  const content = readFileSync(absolute);
  return {
    exists: true,
    bytes: stat.size,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
];

function hasSecretRisk(base, path, metadata) {
  const name = path.split('/').at(-1)?.toLowerCase() ?? '';
  if (name === '.env' || /\.(?:jks|keystore|p12|pfx|key)$/.test(name)) return true;
  if (!metadata.exists || metadata.bytes === 0 || metadata.bytes > 1024 * 1024) return false;
  const extension = extname(name);
  if (/\.(?:png|jpe?g|gif|webp|ico|pdf|apk|aab|zip|jar)$/.test(extension)) return false;
  const text = readFileSync(join(base, path), 'utf8');
  return secretPatterns.some((pattern) => pattern.test(text));
}

function commitScope(repo, path) {
  if (repo === 'website') return 'E_WEBSITE_NESTED_REPO';
  if (path.startsWith('AGM_LIBRARY/') || path.startsWith('CAR_MOVER/')) {
    return 'A_LIBRARY_AUTHORITY_CLOSURE';
  }
  if (path.startsWith('evidence/')) return 'F_EVIDENCE_ARTIFACT_HANDLING';
  if (path.startsWith('apps/web/android/') || /android/i.test(path)) {
    return 'D_ANDROID_RELEASE_CONFIGURATION';
  }
  if (path.startsWith('apps/web/')) return 'C_WEB_I18N_APP_FIXES';
  return 'B_RUNTIME_CANONICAL_FRESHNESS_INTEGRATION';
}

function classify(repo, path, metadata, secretRisk) {
  const normalized = path.toLowerCase();
  const extension = extname(normalized);
  if (secretRisk) return 'SECRET_RISK';
  if (extension === '.apk' || extension === '.aab') return 'ANDROID_RELEASE_ARTIFACT';
  if (
    /(^|\/)(?:\.tmp|tmp|temp|temporary|interrupted)(\/|$)/.test(normalized) ||
    /\.(?:tmp|part|crdownload|lck)$/.test(normalized)
  ) {
    return 'TEMPORARY';
  }
  if (
    /(^|\/)(?:node_modules|dist|build|coverage|\.astro|\.gradle)(\/|$)/.test(normalized)
  ) {
    return 'GENERATED';
  }
  if (metadata.bytes >= largeArtifactBytes) return 'LARGE_ARTIFACT';
  if (repo === 'website') return 'WEBSITE_REPO_CHANGE';
  if (path.startsWith('AGM_LIBRARY/')) return 'INTENDED_LIBRARY';
  if (path.startsWith('evidence/') || path.startsWith('CAR_MOVER/')) return 'INTENDED_EVIDENCE';
  return 'INTENDED_SOURCE';
}

const rootItems = parseStatus(
  git(['status', '--porcelain=v1', '-z', '--untracked-files=all']),
);

let websiteItems = [];
let websiteHead = null;
if (existsSync(join(websiteRoot, '.git'))) {
  const safeDirectory = websiteRoot.replaceAll('\\', '/');
  websiteItems = parseStatus(
    git(
      ['-c', `safe.directory=${safeDirectory}`, 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
      websiteRoot,
    ),
    'website',
  );
  websiteHead = git(
    ['-c', `safe.directory=${safeDirectory}`, 'rev-parse', 'HEAD'],
    websiteRoot,
  ).trim();
}

const inventory = [...rootItems, ...websiteItems].map((item) => {
  const base = item.repo === 'website' ? websiteRoot : root;
  const metadata = fileMetadata(base, item.path);
  const secretRisk = hasSecretRisk(base, item.path, metadata);
  const category = classify(item.repo, item.path, metadata, secretRisk);
  const scope = commitScope(item.repo, item.path);
  return {
    ...item,
    ...metadata,
    category,
    proposedCommitScope: scope,
    proposedAction:
      category === 'SECRET_RISK'
        ? 'EXCLUDE_AND_ROTATE_IF_REAL'
        : category === 'TEMPORARY'
          ? 'REMOVE_AFTER_OWNER_CONFIRMATION'
          : category === 'GENERATED'
            ? 'EXCLUDE_FROM_GIT'
            : category === 'ANDROID_RELEASE_ARTIFACT'
              ? 'KEEP_OUTSIDE_NORMAL_GIT'
              : category === 'LARGE_ARTIFACT'
                ? 'ARTIFACT_STORAGE_OR_GIT_LFS_REVIEW'
                : `PROPOSE_${scope}`,
  };
});

const temporaryRoot = join(root, '.tmp');
const ignoredTemporaryResidue = existsSync(temporaryRoot)
  ? readdirSync(temporaryRoot, { withFileTypes: true })
      .map((entry) => ({
        path: `.tmp/${entry.name}`,
        category: 'TEMPORARY',
        kind: entry.isDirectory() ? 'directory' : 'file',
        proposedAction: 'REMOVE_ONLY_WITH_EXPLICIT_PRODUCT_OWNER_DELETION_AUTHORIZATION',
      }))
      .sort((a, b) => a.path.localeCompare(b.path))
  : [];

function countBy(field) {
  return Object.fromEntries(
    [...new Set(inventory.map((item) => item[field]))]
      .sort()
      .map((value) => [value, inventory.filter((item) => item[field] === value).length]),
  );
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  readOnlyClassification: true,
  git: {
    rootHead: git(['rev-parse', 'HEAD']).trim(),
    rootEntries: rootItems.length,
    websiteHead,
    websiteEntries: websiteItems.length,
  },
  summary: {
    totalEntries: inventory.length,
    unclassifiedWorkspaceItems: inventory.filter((item) => !item.category).length,
    temporaryReleaseResidue:
      inventory.filter((item) => item.category === 'TEMPORARY').length
      + ignoredTemporaryResidue.length,
    secretRiskUnresolved: inventory.filter((item) => item.category === 'SECRET_RISK').length,
    categories: countBy('category'),
    proposedCommitScopes: countBy('proposedCommitScope'),
  },
  ignoredTemporaryResidue,
  inventory,
};

const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) {
  const rawTarget = process.argv[outputIndex + 1];
  if (!rawTarget) throw new Error('--output requires a path');
  const target = isAbsolute(rawTarget) ? rawTarget : resolve(root, rawTarget);
  if (relative(root, target).startsWith('..')) {
    throw new Error('Output must remain inside the AGM workspace');
  }
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`);
