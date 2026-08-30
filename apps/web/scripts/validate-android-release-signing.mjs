import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const required = [
  'AGM_ANDROID_RELEASE_KEYSTORE',
  'AGM_ANDROID_RELEASE_STORE_PASSWORD',
  'AGM_ANDROID_RELEASE_KEY_ALIAS',
  'AGM_ANDROID_RELEASE_KEY_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`ANDROID_RELEASE_SIGNING_CONFIGURATION_REQUIRED:${missing.join(',')}`);
  process.exit(1);
}
const configured = process.env.AGM_ANDROID_RELEASE_KEYSTORE;
const keystore = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
if (!existsSync(keystore) || !statSync(keystore).isFile()) {
  console.error('ANDROID_RELEASE_KEYSTORE_NOT_FOUND');
  process.exit(1);
}

const javaHome = process.env.JAVA_HOME?.trim() || 'C:\\Program Files\\Android\\Android Studio\\jbr';
const keytool = resolve(javaHome, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool');
if (!existsSync(keytool)) {
  console.error('ANDROID_RELEASE_KEYTOOL_NOT_FOUND');
  process.exit(1);
}

let certificate;
try {
  certificate = execFileSync(
    keytool,
    [
      '-list',
      '-v',
      '-keystore',
      keystore,
      '-alias',
      process.env.AGM_ANDROID_RELEASE_KEY_ALIAS,
      '-storepass:env',
      'AGM_ANDROID_RELEASE_STORE_PASSWORD',
    ],
    { encoding: 'utf8', env: process.env, windowsHide: true },
  );
} catch {
  console.error('ANDROID_RELEASE_KEYSTORE_OR_ALIAS_VALIDATION_FAILED');
  process.exit(1);
}

const sha256 = certificate.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1] ?? null;
const sha1 = certificate.match(/SHA1:\s*([0-9A-F:]+)/i)?.[1] ?? null;
const validity = certificate.match(/Valid from:\s*(.+?)\s+until:\s*(.+)/i);
const validUntil = validity?.[2]?.trim() ?? null;
const validUntilTimestamp = validUntil ? Date.parse(validUntil) : Number.NaN;
if (!sha256 || !validUntil || !Number.isFinite(validUntilTimestamp)) {
  console.error('ANDROID_RELEASE_CERTIFICATE_METADATA_UNREADABLE');
  process.exit(1);
}
if (validUntilTimestamp <= Date.now()) {
  console.error('ANDROID_RELEASE_CERTIFICATE_EXPIRED');
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  signingConfiguration: 'PRESENT',
  keystorePath: keystore,
  keyAliasConfigured: true,
  keyAliasValidated: true,
  certificateValidUntil: validUntil,
  certificateSha1: sha1,
  certificateSha256: sha256,
  keystoreSha256: createHash('sha256').update(readFileSync(keystore)).digest('hex'),
  secretsPrinted: false,
}));
