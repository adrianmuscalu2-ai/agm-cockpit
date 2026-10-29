import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = process.cwd();
const serial = process.env.AGM_ANDROID_SERIAL ?? 'RFCY70WDHXK';
const packageName = process.env.AGM_ANDROID_PACKAGE ?? 'com.agm.cockpit.storagetest';
const apk = process.env.AGM_ANDROID_APK;
const adb = path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'phase3', 'android-physical', runId);
const report = { schemaVersion: 1, runId, status: 'FAIL', checks: [], networkRequests: [], packageName, serial };
let browser;
let fatal;

const check = (id, passed, evidence) => report.checks.push({ id, status: passed ? 'PASS' : 'FAIL', evidence });
const adbRun = (...args) => run(adb, ['-s', serial, ...args], { maxBuffer: 16 * 1024 * 1024 });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(output, { recursive: true });
try {
  if (!apk) throw new Error('AGM_ANDROID_APK_REQUIRED');
  const apkBytes = await readFile(apk);
  const apkSha256 = createHash('sha256').update(apkBytes).digest('hex').toUpperCase();
  const deviceRows = (await run(adb, ['devices', '-l'])).stdout;
  if (!deviceRows.includes(`${serial}`) || !deviceRows.includes(' device ')) throw new Error('AUTHORIZED_DEVICE_NOT_CONNECTED');
  report.device = {
    model: (await adbRun('shell', 'getprop', 'ro.product.model')).stdout.trim(),
    android: (await adbRun('shell', 'getprop', 'ro.build.version.release')).stdout.trim(),
    sdk: (await adbRun('shell', 'getprop', 'ro.build.version.sdk')).stdout.trim(),
  };
  const packageDetail = (await adbRun('shell', 'dumpsys', 'package', packageName)).stdout;
  report.build = {
    sourceHead: '5a85ed7797161fa0bc198c04b0e4b4354b90f69d',
    sourceTree: 'fcbee0f30c3ff7f78cad577acd83dac99c7a91cc',
    apkSha256,
    versionCode: packageDetail.match(/versionCode=(\d+)/)?.[1],
    versionName: packageDetail.match(/versionName=([^\r\n]+)/)?.[1]?.trim(),
  };
  const installedPath = (await adbRun('shell', 'pm', 'path', packageName)).stdout.trim().replace('package:', '');
  const installedSha256 = (await adbRun('shell', 'sha256sum', installedPath)).stdout.trim().split(/\s+/)[0].toUpperCase();
  report.build.installedSha256 = installedSha256;
  check('APK_PROVENANCE', installedSha256 === apkSha256, report.build);
  check('ANDROID_1_6_AUTHORITY', report.build.versionCode === '28' && report.build.versionName === '1.6.0-storage-test', report.build);

  for (const permission of ['android.permission.RECORD_AUDIO', 'android.permission.CAMERA', 'android.permission.READ_CONTACTS']) {
    await adbRun('shell', 'pm', 'grant', packageName, permission);
  }
  await adbRun('shell', 'am', 'force-stop', packageName);
  await adbRun('forward', '--remove', 'tcp:9224').catch(() => undefined);
  await adbRun('shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1');
  await wait(1800);
  const pid = (await adbRun('shell', 'pidof', packageName)).stdout.trim().split(/\s+/)[0];
  if (!pid) throw new Error('ANDROID_PROCESS_NOT_RUNNING');
  await adbRun('forward', 'tcp:9224', `localabstract:webview_devtools_remote_${pid}`);
  browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => !candidate.url().includes('sw.js'));
  if (!page) throw new Error('ANDROID_WEBVIEW_PAGE_UNAVAILABLE');
  page.setDefaultTimeout(15_000);
  page.on('request', (request) => { if (request.url().includes('/api/v1/')) report.networkRequests.push({ method: request.method(), url: request.url() }); });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const data = url.pathname.endsWith('/auth/entitlements')
      ? { subjectId: 'phase3-physical', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant', 'car-mover.jobs'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' }
      : url.pathname.endsWith('/auth/refresh')
        ? { accessToken: 'phase3-physical-fixture', user: { id: 'phase3-physical', displayName: 'Phase 3 Physical', email: 'physical@example.test', roles: ['PREMIUM_ACCESS'] } }
        : url.pathname.endsWith('/car-mover/jobs') ? [] : null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'phase3-physical-readonly' }) });
  });
  await page.evaluate(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
    sessionStorage.setItem('agm.auth.accessToken', 'phase3-physical-fixture');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  const native = await page.evaluate(async () => {
    const capability = window.Capacitor?.Plugins?.AgmCapability;
    const audio = window.Capacitor?.Plugins?.AgmAudio;
    if (!capability || !audio) throw new Error('CAPACITOR_NATIVE_PLUGINS_UNAVAILABLE');
    const capabilities = await capability.getCapabilities();
    const protocol = await capability.getAndroidActionProtocolStatus();
    const contactsPermission = await capability.checkContactsPermission();
    const contactProbe = await capability.resolveContact({ name: 'AGM Phase Three Nonexistent Contact' });
    const microphonePermission = await audio.checkMicrophonePermission();
    await audio.speak({ text: 'AGM physical foreground voice check', language: 'en-US', turnId: `phase3-${Date.now()}` });
    await audio.stopSpeaking();
    const cycleId = `phase3-stt-${Date.now()}`;
    const listening = audio.startListening({ language: 'en-US', cycleId, preferOnDevice: true })
      .then((value) => ({ outcome: 'RESULT', value }))
      .catch((error) => ({ outcome: 'CANCELLED', error: String(error) }));
    await new Promise((resolve) => setTimeout(resolve, 900));
    await audio.stopListening();
    return { capabilities, protocol, contactsPermission, contactProbe, microphonePermission, listening: await listening };
  });
  report.native = native;
  check('NATIVE_CAPABILITIES', native.capabilities.camera === true && native.capabilities.speechRecognition === true && native.capabilities.textToSpeech === true, native.capabilities);
  check('FOREGROUND_VOICE', native.microphonePermission.state === 'granted' && ['CANCELLED', 'RESULT'].includes(native.listening.outcome), { permission: native.microphonePermission, listening: native.listening });
  check('CONTACTS_NATIVE_BRIDGE', native.contactsPermission.state === 'granted' && native.contactProbe.status !== 'PERMISSION_DENIED', { permission: native.contactsPermission, resultStatus: native.contactProbe.status });
  check('GMAIL_EMAIL_HANDLER', native.protocol.targets.emailDraft === true, native.protocol.targets);
  check('MESSENGER_HANDLER', typeof native.protocol.targets.messenger === 'boolean', { available: native.protocol.targets.messenger });
  check('NAVIGATION_HANDLER', native.protocol.targets.navigation === true, { navigation: native.protocol.targets.navigation, providers: native.protocol.navigationApps });

  await page.goto('https://localhost/profile', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-personal-contacts]').evaluate((details) => { details.open = true; });
  await page.locator('#openPersonalContacts').click();
  await page.locator('[data-contact-email-row]').first().waitFor({ state: 'visible' });
  await page.locator('#contactName').fill('Phase Three Physical Contact');
  await page.locator('[data-contact-email-label]').first().fill('personal');
  await page.locator('[data-contact-email-value]').first().fill('personal@example.test');
  const initialEmailRows = await page.locator('[data-contact-email-row]').count();
  await page.locator('#addContactEmail').evaluate((button) => button.click());
  await page.waitForFunction((expected) => document.querySelectorAll('[data-contact-email-row]').length === expected, initialEmailRows + 1);
  const rows = page.locator('[data-contact-email-row]');
  if (await rows.count() !== initialEmailRows + 1) throw new Error('MULTIPLE_EMAIL_ROWS_NOT_RENDERED');
  await rows.last().locator('[data-contact-email-label]').fill('work');
  await rows.last().locator('[data-contact-email-value]').fill('work@example.test');
  await rows.last().locator('[data-contact-email-default]').check();
  check('MULTIPLE_EMAIL_UI', await rows.count() >= 2, { initialEmailRows, rowsAfterAdd: await rows.count(), labels: ['personal', 'work'], default: 'work' });
  const profileCapture = path.join(output, 'profile-multiple-email-rows.png');
  await page.screenshot({ path: profileCapture, fullPage: true });
  await page.locator('#saveContact').click();
  const persistedBeforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('agm.contact-manager.contacts') ?? '[]').find((entry) => entry.name === 'Phase Three Physical Contact'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  const persistedAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('agm.contact-manager.contacts') ?? '[]').find((entry) => entry.name === 'Phase Three Physical Contact'));
  const persistencePassed = persistedBeforeReload?.emails?.length >= 2
    && persistedBeforeReload.emails.some((entry) => entry.label === 'work' && entry.value === 'work@example.test' && entry.isDefault === true)
    && JSON.stringify(persistedAfterReload) === JSON.stringify(persistedBeforeReload);
  check('MULTIPLE_EMAIL_PERSISTENCE_RELOAD', persistencePassed, { emails: persistedAfterReload?.emails, projectedEmail: persistedAfterReload?.email });

  await page.goto('https://localhost/car-mover', { waitUntil: 'domcontentloaded' });
  await page.locator('.car-mover-entry').waitFor({ state: 'visible' });
  await page.locator('[data-module="carMoverMenu"]').click();
  await page.locator('.car-mover-menu-card').first().waitFor({ state: 'visible' });
  check('CAR_MOVER_PHYSICAL_UI', await page.locator('.car-mover-menu-card').count() === 6, { cards: await page.locator('.car-mover-menu-card').count(), origin: new URL(page.url()).origin });
  const carMoverCapture = path.join(output, 'car-mover-six-module-hub.png');
  await page.screenshot({ path: carMoverCapture, fullPage: true });

  const relevantFailures = report.checks.filter((entry) => entry.status === 'FAIL' && entry.id !== 'MESSENGER_HANDLER');
  report.status = relevantFailures.length === 0 ? 'PASS' : 'FAIL';
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await adbRun('forward', '--remove', 'tcp:9224').catch(() => undefined);
  await Promise.race([browser?.close().catch(() => undefined), wait(2000)]);
  report.fatal = fatal;
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PHASE 3 ANDROID PHYSICAL: ${report.status}`);
  console.log(path.join(output, 'report.json'));
  if (fatal || report.status !== 'PASS') process.exitCode = 1;
}
