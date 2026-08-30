import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const webRoot = resolve(import.meta.dirname, '..');
const aab = resolve(webRoot, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
const buildFile = resolve(webRoot, 'android', 'app', 'build.gradle');
const javaHome = process.env.JAVA_HOME?.trim() || 'C:\\Program Files\\Android\\Android Studio\\jbr';
const executable = (name) => resolve(javaHome, 'bin', process.platform === 'win32' ? `${name}.exe` : name);
const jarsigner = executable('jarsigner');
const keytool = executable('keytool');
const jar = executable('jar');

if (!existsSync(aab) || !statSync(aab).isFile()) {
  console.error('ANDROID_SIGNED_RELEASE_AAB_NOT_FOUND');
  process.exit(1);
}
for (const [name, path] of Object.entries({ jarsigner, keytool, jar })) {
  if (!existsSync(path)) {
    console.error(`ANDROID_${name.toUpperCase()}_NOT_FOUND`);
    process.exit(1);
  }
}

const build = readFileSync(buildFile, 'utf8');
const applicationId = build.match(/applicationId\s+["']([^"']+)["']/)?.[1] ?? null;
const versionName = build.match(/versionName\s+["']([^"']+)["']/)?.[1] ?? null;
const versionCode = Number(build.match(/versionCode\s+(\d+)/)?.[1] ?? Number.NaN);
if (applicationId !== 'com.agm.cockpit' || versionName !== '1.3.0' || versionCode !== 21) {
  console.error('ANDROID_RELEASE_IDENTITY_OR_VERSION_MISMATCH');
  process.exit(1);
}

try {
  execFileSync(jarsigner, ['-verify', '-strict', aab], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch {
  console.error('ANDROID_RELEASE_AAB_SIGNATURE_INVALID');
  process.exit(1);
}

const certificate = execFileSync(keytool, ['-printcert', '-jarfile', aab], {
  encoding: 'utf8',
  windowsHide: true,
});
const owner = certificate.match(/Owner:\s*(.+)/i)?.[1]?.trim() ?? null;
const certificateSha256 = certificate.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1] ?? null;
if (!owner || !certificateSha256 || /android debug/i.test(owner)) {
  console.error('ANDROID_RELEASE_AAB_DEBUG_OR_UNIDENTIFIED_SIGNER');
  process.exit(1);
}

const entries = execFileSync(jar, ['tf', aab], { encoding: 'utf8', windowsHide: true })
  .split(/\r?\n/)
  .filter(Boolean);
const requiredEntries = ['BundleConfig.pb', 'base/manifest/AndroidManifest.xml'];
const missingEntries = requiredEntries.filter((entry) => !entries.includes(entry));
if (missingEntries.length) {
  console.error(`ANDROID_RELEASE_AAB_STRUCTURE_INVALID:${missingEntries.join(',')}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  path: aab,
  bytes: statSync(aab).size,
  sha256: createHash('sha256').update(readFileSync(aab)).digest('hex'),
  applicationId,
  versionName,
  versionCode,
  signature: 'VALID',
  debugSigned: false,
  signerOwner: owner,
  signerCertificateSha256: certificateSha256,
  structure: 'VALID',
  secretsPrinted: false,
}, null, 2));
