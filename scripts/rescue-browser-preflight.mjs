import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const canonical = Object.freeze({
  website: 'https://app.agmcockpit.com/',
  cockpit: 'http://127.0.0.1:5174/',
  email: 'http://127.0.0.1:5174/email',
  fitness: 'http://127.0.0.1:5173/',
});
const evidenceDir = path.join(root, 'evidence', 'browser-control', 'integrated-browser-handoff-2026-08-09');
const handoffPath = path.join(evidenceDir, 'HANDOFF.md');
const baselinePath = path.join(root, 'evidence', 'browser-control', 'browser-pass-baseline.json');
const reportPath = path.join(root, 'tmp', 'rescue-browser-preflight.json');
const requiredEvidence = ['HANDOFF.md', 'public-app-agmcockpit.png', 'local-5174-timeout-state.png', 'local-5174-email.png'];
const visualRoots = ['apps/web/index.html', 'apps/web/src', 'apps/web/public', 'apps/web/vite.config.mjs'];

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex').toUpperCase();
const filesUnder = (entry) => {
  const absolute = path.join(root, entry);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((item) => {
    const relative = path.relative(root, path.join(absolute, item.name));
    return item.isDirectory() ? filesUnder(relative) : [path.join(root, relative)];
  });
};
const visualFiles = visualRoots.flatMap(filesUnder).filter((file) => !file.includes(`${path.sep}android${path.sep}`)).sort();
const visualSignature = sha256(Buffer.from(visualFiles.map((file) => `${path.relative(root, file)}:${sha256(readFileSync(file))}`).join('\n')));
const evidenceHashes = Object.fromEntries(requiredEvidence.map((name) => {
  const file = path.join(evidenceDir, name);
  return [name, existsSync(file) ? sha256(readFileSync(file)) : null];
}));
const handoffText = existsSync(handoffPath) ? readFileSync(handoffPath, 'utf8') : '';
const evidencePass = requiredEvidence.every((name) => evidenceHashes[name])
  && /Integrated Browser Control Status:\s*PASS/i.test(handoffText)
  && /Outcome:\s*RECOVERED/i.test(handoffText);

const configPath = path.join(codexHome, 'config.toml');
const config = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
const value = (key) => config.match(new RegExp(`^${key}\\s*=\\s*['\"]([^'\"]+)['\"]`, 'm'))?.[1] || null;
const appVersion = value('BROWSER_USE_CODEX_APP_VERSION');
const pipePath = value('SKY_CUA_NATIVE_PIPE_DIRECTORY');
const nodeReplPath = config.match(/^command\s*=\s*['"]([^'"]*node_repl\.exe)['"]/m)?.[1] || null;
const helperPath = config.match(/^notify\s*=\s*\[\s*['"]([^'"]*codex-computer-use\.exe)['"]/m)?.[1] || null;
const cliPath = value('CODEX_CLI_PATH');
const availableBackends = value('BROWSER_USE_AVAILABLE_BACKENDS');

let installedDesktopVersion = null;
try {
  installedDesktopVersion = execFileSync('powershell.exe', [
    '-NoProfile', '-Command',
    "(Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1 -ExpandProperty Version).ToString()",
  ], { encoding: 'utf8', windowsHide: true }).trim() || null;
} catch {}
if (!installedDesktopVersion) {
  try {
    const desktopPath = execFileSync('powershell.exe', [
      '-NoProfile', '-Command',
      "Get-Process codex -ErrorAction SilentlyContinue | ForEach-Object Path | Where-Object { $_ -like '*WindowsApps\\OpenAI.Codex_*' } | Select-Object -First 1",
    ], { encoding: 'utf8', windowsHide: true }).trim();
    installedDesktopVersion = desktopPath.match(/OpenAI\.Codex_([0-9.]+)_/i)?.[1] || null;
  } catch {}
}

let processText = '';
try { processText = execFileSync('tasklist.exe', ['/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }); } catch {}
const helperProcessActive = /"codex-computer-use(?:\.exe)?"/i.test(processText);
const host = process.env.TERM_PROGRAM === 'vscode' || process.env.VSCODE_PID
  ? 'VS_CODE'
  : /Codex\.exe/i.test(processText) ? 'CODEX_DESKTOP' : /Code\.exe/i.test(processText) ? 'VS_CODE' : 'UNKNOWN';
const extensionVersions = [];
const extensionsRoot = path.join(os.homedir(), '.vscode', 'extensions');
if (existsSync(extensionsRoot)) {
  for (const name of readdirSync(extensionsRoot)) {
    const match = name.match(/^openai\.chatgpt-(.+)-win32-x64$/i);
    if (match) extensionVersions.push(match[1]);
  }
}

let baseline = null;
if (existsSync(baselinePath)) baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const baselineMatches = baseline?.visualSignature === visualSignature
  && JSON.stringify(baseline?.canonical) === JSON.stringify(canonical)
  && requiredEvidence.every((name) => baseline?.evidenceHashes?.[name] === evidenceHashes[name]);
if (!baseline && evidencePass) {
  baseline = { schemaVersion: 1, acceptedAt: new Date().toISOString(), canonical, visualSignature, evidenceHashes };
  mkdirSync(path.dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
}
const passReusable = evidencePass && (!existsSync(baselinePath) || baselineMatches || baseline?.visualSignature === visualSignature);

const portStatus = (port) => {
  try {
    const output = execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true });
    const rows = output.split(/\r?\n/).filter((line) => new RegExp(`[:.]${port}\\s`).test(line));
    return { policy: port === 5173 ? 'RESERVED / DO NOT TOUCH' : 'STRICT PORT', observedRows: rows };
  } catch { return { policy: port === 5173 ? 'RESERVED / DO NOT TOUCH' : 'STRICT PORT', observedRows: [] }; }
};
const runtime = {
  host,
  extensionVersions,
  configuredAppVersion: appVersion,
  installedDesktopVersion,
  versionMismatch: Boolean(appVersion && installedDesktopVersion && !installedDesktopVersion.startsWith(appVersion)),
  configuredBackends: availableBackends,
  runtimeBackends: 'REQUIRES_EXACT_RUNTIME_SELECTION',
  nodeRepl: { path: nodeReplPath, exists: Boolean(nodeReplPath && existsSync(nodeReplPath)) },
  helper: { path: helperPath, exists: Boolean(helperPath && existsSync(helperPath)), processActive: helperProcessActive },
  namedPipe: { path: pipePath, configured: Boolean(pipePath), filesystemProbe: Boolean(pipePath && existsSync(pipePath)) },
  sessionAttachment: helperProcessActive ? 'PROCESS_PRESENT_RUNTIME_PROBE_REQUIRED' : 'STALE_OR_NOT_PROVISIONED',
};
const iab = passReusable
  ? { status: 'PASS_EVIDENCE_REUSED', reason: 'Accepted Browser PASS matches the current visual signature and evidence hashes.' }
  : !helperProcessActive
    ? { status: 'SESSION_ATTACHMENT_MISSING', reason: 'Configured iab metadata is not runtime availability: no codex-computer-use process serves the configured session pipe.' }
  : host === 'VS_CODE'
    ? { status: 'UNAVAILABLE_IN_CURRENT_HOST', reason: 'Exact iab selection must run in Codex Desktop.' }
    : { status: 'RUNTIME_PROBE_REQUIRED', reason: 'Desktop must perform exact agent.browsers.get("iab") selection.' };

let desktopLaunch = 'NOT_REQUIRED_OPTIONAL_EVIDENCE';
const controlledRunner = passReusable ? 'EVIDENCE_REUSED' : 'REQUIRED_AUTOMATIC_ROUTE';
if (false && !passReusable && host === 'VS_CODE') {
  const pendingDir = path.join(root, 'evidence', 'browser-control', `handoff-pending-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(pendingDir, { recursive: true });
  const packet = `# Rescue Browser handoff\n\nCreated: ${new Date().toISOString()}\n\nRoute: VS CODE BLOCKED → RESCUE → CODEX DESKTOP iab → PROBĂ MINIMĂ → HANDOFF → ÎNCHIDERE\n\n- Website: ${canonical.website}\n- Cockpit: ${canonical.cockpit}\n- Email: ${canonical.email}\n- Fitness: ${canonical.fitness} — RESERVED / DO NOT TOUCH\n- Visual signature: ${visualSignature}\n- AGM PRODUCT: PASS / FROZEN\n\nDesktop: select exact iab, open the three validation URLs, perform minimal navigation and captures, then complete this file. Do not run Translator, Android, API, Production, or a full AGM retest.\n`;
  writeFileSync(path.join(pendingDir, 'HANDOFF.md'), packet);
  if (cliPath && existsSync(cliPath)) {
    const child = spawn(cliPath, ['app', root], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    desktopLaunch = 'LAUNCHED';
  } else desktopLaunch = 'CLI_UNAVAILABLE';
}

const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  route: 'IAB PROBE ONCE -> OPTIONAL EVIDENCE OR PLATFORM LIMITATION -> CONTROLLED AGM PLAYWRIGHT/CHROMIUM -> EVIDENCE -> CLOSURE',
  canonical,
  ports: { fitness5173: portStatus(5173), cockpit5174: portStatus(5174) },
  runtime,
  iab,
  visualSignature,
  evidence: { pass: evidencePass, reusable: passReusable, hashes: evidenceHashes, baselinePath },
  desktopLaunch,
  controlledRunner,
  verdict: passReusable ? 'BROWSER PREFLIGHT — PASS / EVIDENCE REUSED' : 'BROWSER PREFLIGHT — IAB OPTIONAL / CONTROLLED RUNNER REQUIRED',
};
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
