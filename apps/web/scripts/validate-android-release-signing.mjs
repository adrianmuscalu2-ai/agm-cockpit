import { execFileSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
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

let keyEntry;
let certificatePem;
try {
  keyEntry = execFileSync(
    keytool,
    [
      '-J-Duser.language=en',
      '-J-Duser.country=US',
      '-J-Duser.timezone=UTC',
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
  certificatePem = execFileSync(
    keytool,
    [
      '-J-Duser.language=en',
      '-J-Duser.country=US',
      '-J-Duser.timezone=UTC',
      '-exportcert',
      '-rfc',
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

if (!/Entry type:\s*PrivateKeyEntry/i.test(keyEntry)) {
  console.error('ANDROID_RELEASE_ALIAS_NOT_PRIVATE_KEY');
  process.exit(1);
}

let x509;
try {
  x509 = new X509Certificate(certificatePem);
} catch {
  console.error('ANDROID_RELEASE_CERTIFICATE_METADATA_UNREADABLE');
  process.exit(1);
}
const sha256 = x509.fingerprint256;
const sha1 = x509.fingerprint;
const validFromDate = x509.validFromDate;
const validUntilDate = x509.validToDate;
const validFromTimestamp = validFromDate.getTime();
const validUntilTimestamp = validUntilDate.getTime();
const validFrom = validFromDate.toISOString();
const validUntil = validUntilDate.toISOString();
if (!sha256 || !validFrom || !validUntil
  || !Number.isFinite(validFromTimestamp) || !Number.isFinite(validUntilTimestamp)) {
  console.error('ANDROID_RELEASE_CERTIFICATE_METADATA_UNREADABLE');
  process.exit(1);
}
if (validFromTimestamp > Date.now()) {
  console.error('ANDROID_RELEASE_CERTIFICATE_NOT_YET_VALID');
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
  privateKeyEntryValidated: true,
  certificateValidFrom: validFrom,
  certificateValidUntil: validUntil,
  certificateSha1: sha1,
  certificateSha256: sha256,
  certificateMetadataParser: 'node:X509Certificate',
  keystoreSha256: createHash('sha256').update(readFileSync(keystore)).digest('hex'),
  secretsPrinted: false,
}));
