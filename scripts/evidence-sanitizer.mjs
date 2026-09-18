import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const MAX_BYTES = 100 * 1024 * 1024;
const REDACTED = Object.freeze({
  google_api_key: '[REDACTED_GOOGLE_API_KEY]',
  google_oauth_token: '[REDACTED_GOOGLE_OAUTH_TOKEN]',
  authorization_header: 'Authorization: [REDACTED_AUTHORIZATION]',
  jwt: '[REDACTED_JWT]',
  private_key: '[REDACTED_PRIVATE_KEY]',
  aws_access_key: '[REDACTED_AWS_ACCESS_KEY]',
  github_token: '[REDACTED_GITHUB_TOKEN]',
  openai_key: '[REDACTED_OPENAI_KEY]',
  slack_token: '[REDACTED_SLACK_TOKEN]',
  client_secret: '[REDACTED_CLIENT_SECRET]',
  password: '[REDACTED_PASSWORD]',
  cookie_session: '[REDACTED_SESSION_TOKEN]',
  webhook_secret: '[REDACTED_WEBHOOK_SECRET]',
});

const detectors = [
  { id: 'google_api_key', expression: /AIza[0-9A-Za-z_-]{35}/g },
  { id: 'google_oauth_token', expression: /(?:ya29\.[0-9A-Za-z._-]{20,}|1\/\/[0-9A-Za-z._-]{20,})/g },
  { id: 'authorization_header', expression: /Authorization\s*:\s*(?:Bearer|Basic)\s+[^\s"']{12,}/gi },
  { id: 'jwt', expression: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { id: 'private_key', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { id: 'aws_access_key', expression: /(?:AKIA|ASIA)[A-Z0-9]{16}/g },
  { id: 'github_token', expression: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/g },
  { id: 'openai_key', expression: /sk-(?:proj-)?[A-Za-z0-9_-]{40,}/g },
  { id: 'slack_token', expression: /xox[baprs]-[A-Za-z0-9-]{20,}/g },
  { id: 'client_secret', expression: /\b(?:client[_-]?secret|app[_-]?secret)\b\s*[:=]\s*["']?[^\s,"'}]{8,}/gi, evidenceOnly: true },
  { id: 'password', expression: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?[^\s,"'}]{8,}/gi, evidenceOnly: true },
  { id: 'cookie_session', expression: /(?:set-cookie[ \t]*:|session[_-]?token[ \t]*[:=]|sessionid[ \t]*[:=])[ \t]*[A-Za-z0-9._~+\/=-]{12,}/gi, evidenceOnly: true },
  { id: 'webhook_secret', expression: /\b(?:webhook[_-]?(?:secret|token)|signing[_-]?secret)\b\s*[:=]\s*["']?[^\s,"'}]{8,}/gi, evidenceOnly: true },
];

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isEvidencePath(path) {
  return path.replaceAll('\\', '/').split('/').includes('evidence');
}

function isSafeTemplate(detector, match, text, path) {
  const value = match[0];
  if (/(?:\$\{|\$[A-Z_]|\{\{|REDACTED|EXAMPLE|PLACEHOLDER|CHANGE[_-]?ME|YOUR[_-]?|\*\*\*|<[^>]+>)/i.test(value)) return true;
  const before = match.index > 0 ? text[match.index - 1] : '';
  const after = match.index + value.length < text.length ? text[match.index + value.length] : '';
  if (['google_oauth_token', 'openai_key'].includes(detector.id) && (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after))) return true;
  const lineStart = text.lastIndexOf('\n', Math.max(0, match.index - 1)) + 1;
  const lineEndCandidate = text.indexOf('\n', match.index);
  const lineEnd = lineEndCandidate < 0 ? text.length : lineEndCandidate;
  const line = text.slice(lineStart, lineEnd);
  if (detector.id === 'cookie_session' && /MoseyControllerContextImpl\([ \t]*sessionId[ \t]*=/i.test(line)) return true;
  if (/(?:^|[\\/])(?:test|tests|fixtures?)(?:[\\/.-]|$)/i.test(path) && /\b(?:dummy|fixture|fake|example|synthetic)\b/i.test(line)) return true;
  return false;
}

function scanText(text, path = 'stdin') {
  const evidence = isEvidencePath(path) || path === 'stdin';
  const findings = [];
  for (const detector of detectors) {
    if (detector.evidenceOnly && !evidence) continue;
    const expression = new RegExp(detector.expression.source, detector.expression.flags);
    for (const match of text.matchAll(expression)) {
      if (isSafeTemplate(detector, match, text, path)) continue;
      findings.push({
        category: detector.id,
        path,
        line: text.slice(0, match.index).split('\n').length,
        sha256: digest(match[0]),
      });
    }
  }
  return findings;
}

function sanitizeText(text, path = 'stdin') {
  const evidence = isEvidencePath(path) || path === 'stdin';
  let output = text;
  for (const detector of detectors) {
    if (detector.evidenceOnly && !evidence) continue;
    output = output.replace(new RegExp(detector.expression.source, detector.expression.flags), REDACTED[detector.id]);
  }
  return output;
}

function assertInsideWorkspace(path) {
  const root = resolve(process.cwd());
  const absolute = resolve(path);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) throw new Error(`PATH_OUTSIDE_WORKSPACE:${path}`);
  return absolute;
}

function collect(path, result = []) {
  const absolute = assertInsideWorkspace(path);
  if (!existsSync(absolute)) throw new Error(`PATH_NOT_FOUND:${path}`);
  const stat = lstatSync(absolute);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(absolute)) collect(resolve(absolute, entry), result);
  } else if (stat.isFile()) {
    result.push(absolute);
  }
  return result;
}

function scanBuffer(buffer, path) {
  if (buffer.length > MAX_BYTES) return [{ category: 'unscanned_oversize', path, line: null, sha256: digest(buffer) }];
  return scanText(buffer.toString('latin1'), path);
}

function repositoryFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' });
  return output.toString('utf8').split('\0').filter(Boolean);
}

function stagedFiles() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'buffer' });
  return output.toString('utf8').split('\0').filter(Boolean);
}

const binaryHistoryExtensions = new Set(['.7z', '.aab', '.apk', '.avif', '.bin', '.bmp', '.class', '.dex', '.dll', '.doc', '.docx', '.eot', '.exe', '.gif', '.gz', '.ico', '.jar', '.jpeg', '.jpg', '.keystore', '.mov', '.mp3', '.mp4', '.pdf', '.pfx', '.png', '.so', '.tar', '.ttf', '.wav', '.webm', '.webp', '.woff', '.woff2', '.xls', '.xlsx', '.zip']);

function historyBlobInventory() {
  const rows = execFileSync('git', ['rev-list', '--objects', '--all'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\n');
  const blobs = new Map();
  for (const row of rows) {
    const separator = row.indexOf(' ');
    if (separator < 0) continue;
    const object = row.slice(0, separator);
    const path = row.slice(separator + 1);
    const extensionIndex = path.lastIndexOf('.');
    const extension = extensionIndex < 0 ? '' : path.slice(extensionIndex).toLowerCase();
    if (binaryHistoryExtensions.has(extension)) continue;
    if (!blobs.has(object)) blobs.set(object, path);
  }
  return blobs;
}

function scanHistory() {
  const inventory = historyBlobInventory();
  const objects = [...inventory.keys()];
  if (!objects.length) return { findings: [], scanned: 0 };
  const batch = execFileSync('git', ['cat-file', '--batch'], {
    input: Buffer.from(`${objects.join('\n')}\n`),
    encoding: 'buffer',
    maxBuffer: 512 * 1024 * 1024,
  });
  const findings = [];
  let cursor = 0;
  let scanned = 0;
  while (cursor < batch.length) {
    const headerEnd = batch.indexOf(10, cursor);
    if (headerEnd < 0) break;
    const header = batch.subarray(cursor, headerEnd).toString('utf8');
    cursor = headerEnd + 1;
    const [object, type, sizeText] = header.split(' ');
    if (type === 'missing') continue;
    const size = Number(sizeText);
    const body = batch.subarray(cursor, cursor + size);
    cursor += size + 1;
    if (type !== 'blob') continue;
    const path = inventory.get(object) ?? 'unknown';
    scanned += 1;
    for (const finding of scanBuffer(body, path)) findings.push({ ...finding, object });
  }
  return { findings, scanned };
}
function report(mode, findings, scanned) {
  const safe = { contract: 'agm-evidence-sanitizer.v1', mode, result: findings.length === 0 ? 'PASS' : 'FAIL', scanned, findings };
  process.stdout.write(`${JSON.stringify(safe, null, 2)}\n`);
  if (findings.length) process.exitCode = 1;
}

const [mode, ...args] = process.argv.slice(2);
if (mode === '--stdin') {
  const outputIndex = args.indexOf('--output');
  if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error('OUTPUT_PATH_REQUIRED');
  const outputPath = assertInsideWorkspace(args[outputIndex + 1]);
  const input = readFileSync(0, 'utf8');
  const sanitized = sanitizeText(input, relative(process.cwd(), outputPath));
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, sanitized, { encoding: 'utf8', mode: 0o600 });
  report('stdin-before-disk', scanText(sanitized, relative(process.cwd(), outputPath)), 1);
} else if (mode === '--sanitize') {
  if (!args.length) throw new Error('SANITIZE_PATH_REQUIRED');
  let changed = 0;
  let scanned = 0;
  for (const path of args.flatMap((entry) => collect(entry))) {
    const buffer = readFileSync(path);
    if (buffer.length > MAX_BYTES || buffer.includes(0)) continue;
    scanned += 1;
    const text = buffer.toString('utf8');
    const sanitized = sanitizeText(text, relative(process.cwd(), path));
    if (sanitized === text) continue;
    const temporary = `${path}.sanitizing`;
    writeFileSync(temporary, sanitized, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporary, path);
    changed += 1;
  }
  const findings = args.flatMap((entry) => collect(entry)).flatMap((path) => scanBuffer(readFileSync(path), relative(process.cwd(), path)));
  process.stdout.write(`${JSON.stringify({ contract: 'agm-evidence-sanitizer.v1', mode: 'sanitize-existing', result: findings.length ? 'FAIL' : 'PASS', scanned, changed, findings }, null, 2)}\n`);
  if (findings.length) process.exitCode = 1;
} else if (mode === '--check-staged') {
  const files = stagedFiles();
  const findings = [];
  for (const path of files) {
    const content = execFileSync('git', ['show', `:${path}`], { encoding: 'buffer', maxBuffer: MAX_BYTES + 1024 });
    findings.push(...scanBuffer(content, path));
  }
  report('check-staged', findings, files.length);
} else if (mode === '--check-repository') {
  const files = repositoryFiles();
  const findings = [];
  for (const path of files) {
    if (!existsSync(path)) continue;
    findings.push(...scanBuffer(readFileSync(path), path));
  }
  report('check-repository', findings, files.length);
} else if (mode === '--check-history') {
  const history = scanHistory();
  report('check-history', history.findings, history.scanned);
} else if (mode === '--check') {
  if (!args.length) throw new Error('CHECK_PATH_REQUIRED');
  const files = args.flatMap((entry) => collect(entry));
  const findings = files.flatMap((path) => scanBuffer(readFileSync(path), relative(process.cwd(), path)));
  report('check', findings, files.length);
} else {
  process.stderr.write('Usage: node scripts/evidence-sanitizer.mjs --stdin --output <path> | --sanitize <path...> | --check <path...> | --check-staged | --check-repository | --check-history\n');
  process.exitCode = 2;
}
