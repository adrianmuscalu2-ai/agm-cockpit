import { chromium } from 'playwright';
import { closeSync, openSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const adb = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const serial = 'RFCY70WDHXK';
const publicUrl = 'https://app.agmcockpit.com/';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'voice-barge-in', 'web-mobile-public-physical', runId);
const report = { schemaVersion: 1, runId, status: 'FAIL', device: 'Samsung SM-S931B', serial, browser: 'Chrome Android physical', target: publicUrl, results: [] };
const shell = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' }).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;

await mkdir(out, { recursive: true });
try {
  if (shell('get-state') !== 'device') throw new Error('Physical Android device unavailable');
  report.deviceEvidence = {
    model: shell('shell', 'getprop', 'ro.product.model'),
    android: shell('shell', 'getprop', 'ro.build.version.release'),
    sdk: shell('shell', 'getprop', 'ro.build.version.sdk'),
    chrome: shell('shell', 'dumpsys', 'package', 'com.android.chrome').match(/versionName=([^\r\n]+)/)?.[1]?.trim(),
  };
  shell('shell', 'am', 'force-stop', 'com.android.chrome');
  shell('shell', 'am', 'start', '-n', 'com.android.chrome/com.google.android.apps.chrome.Main', '-a', 'android.intent.action.VIEW', '-d', `${publicUrl}?physicalReview=${encodeURIComponent(runId)}`);
  await delay(3000);
  const socket = shell('shell', 'cat', '/proc/net/unix').match(/@(chrome_devtools_remote[^\s]*)/)?.[1];
  if (!socket) throw new Error('Chrome Android DevTools socket unavailable');
  try { shell('forward', '--remove', 'tcp:9226'); } catch {}
  shell('forward', 'tcp:9226', `localabstract:${socket}`);
  browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const page = context.pages().find(candidate => candidate.url().includes('app.agmcockpit.com')) ?? context.pages()[0];
  if (!page) throw new Error('Chrome Android public page unavailable');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await delay(800);
  const state = await page.evaluate(async () => ({
    url: location.href,
    title: document.title,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyText: document.body.innerText.slice(0, 2000),
    assets: performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /\/assets\//.test(name)),
    serviceWorkers: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).map(registration => registration.scope) : [],
  }));
  const mainStatus = response?.status();
  if (mainStatus !== 200 || !state.url.startsWith('https://app.agmcockpit.com/basic') || !state.title || state.bodyText.length < 100 || state.scrollWidth > state.width + 1 || !state.assets.some(asset => /\/assets\/main-[^/]+\.js/.test(asset))) {
    throw new Error(`Physical public mobile validation failed: ${JSON.stringify({ mainStatus, state })}`);
  }
  const browserShot = path.join(out, 'public-mobile-full-page.png');
  await page.screenshot({ path: browserShot, fullPage: true });
  const deviceShot = path.join(out, 'public-mobile-device.png');
  const fd = openSync(deviceShot, 'w');
  try { execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: null, stdio: ['ignore', fd, 'inherit'] }); } finally { closeSync(fd); }
  report.results.push({ id: 'public-web-mobile-load-responsive-cache-assets', status: 'PASS', mainStatus, ...state, browserScreenshot: path.relative(root, browserShot), deviceScreenshot: path.relative(root, deviceShot), cacheDisabledForReload: true });
  report.status = 'PASS';
} catch (error) {
  report.fatal = String(error?.stack || error);
} finally {
  await browser?.close().catch(() => {});
  try { shell('forward', '--remove', 'tcp:9226'); } catch {}
  // Leave the real public page visible on the physical phone for owner review.
  try { shell('shell', 'am', 'start', '-n', 'com.android.chrome/com.google.android.apps.chrome.Main', '-a', 'android.intent.action.VIEW', '-d', publicUrl); } catch {}
  report.finishedAt = new Date().toISOString();
  const reportPath = path.join(out, 'report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`PUBLIC WEB MOBILE PHYSICAL: ${report.status}`);
  console.log(reportPath);
  if (report.status !== 'PASS') { console.error(report.fatal); process.exitCode = 1; }
}
