import { execFileSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const webRoot = resolve(import.meta.dirname, '..');
const aab = resolve(webRoot, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
const buildFile = resolve(webRoot, 'android', 'app', 'build.gradle');
const signingIdentityFile = resolve(webRoot, 'android', 'release-signing-identity.json');
const javaHome = process.env.JAVA_HOME?.trim() || 'C:\\Program Files\\Android\\Android Studio\\jbr';
const executable = (name) => resolve(javaHome, 'bin', process.platform === 'win32' ? `${name}.exe` : name);
const jarsigner = executable('jarsigner');
const keytool = executable('keytool');
const jar = executable('jar');

if (!existsSync(aab) || !statSync(aab).isFile()) {
  console.error('ANDROID_SIGNED_RELEASE_AAB_NOT_FOUND');
  process.exit(1);
}
if (!existsSync(signingIdentityFile) || !statSync(signingIdentityFile).isFile()) {
  console.error('ANDROID_RELEASE_SIGNING_IDENTITY_NOT_FOUND');
  process.exit(1);
}
for (const [name, path] of Object.entries({ jarsigner, keytool, jar })) {
  if (!existsSync(path)) {
    console.error(`ANDROID_${name.toUpperCase()}_NOT_FOUND`);
    process.exit(1);
  }
}

const build = readFileSync(buildFile, 'utf8');
let signingIdentity;
try {
  signingIdentity = JSON.parse(readFileSync(signingIdentityFile, 'utf8'));
} catch {
  console.error('ANDROID_RELEASE_SIGNING_IDENTITY_INVALID');
  process.exit(1);
}
const expectedCertificateSha256 = signingIdentity.certificateSha256?.trim().toUpperCase() ?? null;
if (!expectedCertificateSha256 || !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(expectedCertificateSha256)) {
  console.error('ANDROID_RELEASE_EXPECTED_CERTIFICATE_FINGERPRINT_INVALID');
  process.exit(1);
}
const applicationId = build.match(/applicationId\s+["']([^"']+)["']/)?.[1] ?? null;
const versionName = build.match(/versionName\s+["']([^"']+)["']/)?.[1] ?? null;
const versionCode = Number(build.match(/versionCode\s+(\d+)/)?.[1] ?? Number.NaN);
if (applicationId !== 'com.agm.cockpit' || versionName !== '1.3.0' || versionCode !== 21) {
  console.error('ANDROID_RELEASE_IDENTITY_OR_VERSION_MISMATCH');
  process.exit(1);
}

try {
  const verification = execFileSync(jarsigner, [
    '-J-Duser.language=en',
    '-J-Duser.country=US',
    '-J-Duser.timezone=UTC',
    '-verify',
    '-verbose',
    '-certs',
    aab,
  ], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!/jar verified\./i.test(verification)) {
    throw new Error('jarsigner did not confirm verification');
  }
} catch {
  console.error('ANDROID_RELEASE_AAB_SIGNATURE_INVALID');
  process.exit(1);
}

const certificate = execFileSync(keytool, [
  '-J-Duser.language=en',
  '-J-Duser.country=US',
  '-J-Duser.timezone=UTC',
  '-printcert',
  '-rfc',
  '-jarfile',
  aab,
], {
  encoding: 'utf8',
  windowsHide: true,
});
let signer;
try {
  const certificatePem = certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)?.[0];
  if (!certificatePem) throw new Error('certificate PEM not found');
  signer = new X509Certificate(certificatePem);
} catch {
  console.error('ANDROID_RELEASE_AAB_SIGNER_CERTIFICATE_UNREADABLE');
  process.exit(1);
}
const owner = signer.subject;
const certificateSha256 = signer.fingerprint256;
if (!owner || !certificateSha256 || /android debug/i.test(owner)) {
  console.error('ANDROID_RELEASE_AAB_DEBUG_OR_UNIDENTIFIED_SIGNER');
  process.exit(1);
}
if (certificateSha256.toUpperCase() !== expectedCertificateSha256) {
  console.error('ANDROID_RELEASE_AAB_CERTIFICATE_FINGERPRINT_MISMATCH');
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
  expectedCertificateSha256,
  certificateFingerprintMatch: true,
  certificateMetadataParser: 'node:X509Certificate',
  structure: 'VALID',
  secretsPrinted: false,
}, null, 2));
