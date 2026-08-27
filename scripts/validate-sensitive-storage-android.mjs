import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adb = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const serial = process.argv[2];
if (!serial) throw new Error('ANDROID_SERIAL_REQUIRED');
const shell = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'phase2-technical-closure', 'android', runId);
const keys = [
  'agm.auth.rememberedEmail', 'agm.profile.settings', 'agm.contact-manager.contacts',
  'agm.ocr.history.v1', 'agm.turn.incident-journal.v1', 'agm.e6.pre-departure.session.v1',
  'agm.pre-departure.outbox.v1', 'agm.pre-departure.sync-ack.v1', 'agm.pre-departure.sync-meta.v1',
  'agm.poc02.after-departure.session.v1', 'agm.premium.trip-context.v1',
  'agm.premium.operational-events.v1', 'agm.premium.operational-outbox.v1',
  'agm.premium.operational-conflicts.v1', 'agm.premium.operational-case.v1',
  'agm.premium.field-batch-01.v1', 'agm.premium.field-batch-02.v1',
  'agm.premium.field-batch-02.safety.v1', 'agm.premium.communication-timeline.v1',
  'agm.premium.single-copilot.state.v1', 'agm.premium.voice.telemetry.v1',
  'agm.wave2b.communication-ledger.v1', 'agm.wave2d.conversational-routing.v1',
];

await mkdir(output, { recursive: true });
let browser;
let fatal;
const results = [];
try {
  shell('shell', 'am', 'force-stop', 'com.agm.cockpit.storagetest');
  shell('shell', 'monkey', '-p', 'com.agm.cockpit.storagetest', '-c', 'android.intent.category.LAUNCHER', '1');
  await new Promise((resolve) => setTimeout(resolve, 1800));
  const socket = shell('shell', 'cat', '/proc/net/unix').match(/@(webview_devtools_remote_\d+)/)?.[1];
  if (!socket) throw new Error('ANDROID_WEBVIEW_SOCKET_UNAVAILABLE');
  shell('forward', 'tcp:9222', `localabstract:${socket}`);
  browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => !candidate.url().includes('sw.js'));
  if (!page) throw new Error('ANDROID_WEBVIEW_PAGE_UNAVAILABLE');
  await page.evaluate((sensitiveKeys) => {
    for (const key of sensitiveKeys) localStorage.setItem(key, JSON.stringify({ synthetic: true }));
    sessionStorage.setItem('agm.profile.settings', JSON.stringify({ synthetic: true }));
  }, keys);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);
  const state = await page.evaluate((sensitiveKeys) => ({
    remainingSensitiveLocalKeys: sensitiveKeys.filter((key) => localStorage.getItem(key) !== null),
    remainingSyntheticSessionValue: sessionStorage.getItem('agm.profile.settings'),
  }), keys);
  if (state.remainingSensitiveLocalKeys.length || state.remainingSyntheticSessionValue !== null) {
    throw new Error(`ANDROID_STORAGE_CLEANUP_FAILED:${JSON.stringify(state)}`);
  }
  const screenshot = path.join(output, 'android-sensitive-storage-cleanup.png');
  const fd = openSync(screenshot, 'w');
  try { execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: null, stdio: ['ignore', fd, 'inherit'] }); }
  finally { closeSync(fd); }
  results.push({ id: 'android-webview-sensitive-storage-cleanup', status: 'PASS', ...state, screenshot: path.relative(root, screenshot) });
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  try { shell('forward', '--remove', 'tcp:9222'); } catch {}
  const report = { schemaVersion: 1, runId, status: fatal ? 'FAIL' : 'PASS', deviceSerial: serial, package: 'com.agm.cockpit.storagetest', isolation: 'SEPARATE_TEST_APPLICATION_ID', syntheticOnly: true, productionApiCalls: false, results, fatal, finishedAt: new Date().toISOString() };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`SENSITIVE STORAGE ANDROID: ${report.status}\n${path.join(output, 'report.json')}\n`);
  if (fatal) process.exitCode = 1;
}
