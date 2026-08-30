import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const checks = [];
const check = (name, pass, details) => checks.push({ name, pass, details });
const sha = (path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const expected = {
  'AGM_LIBRARY/REGISTRY/canonical-sources.json': '7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245',
  'AGM_LIBRARY/VIEWS/legislation-safety.view.json': 'c6d45d7c4fcc86574790add0491e37727691909f287d461e356be05f69a1b0ab',
  'AGM_LIBRARY/VIEWS/routing-toll.view.json': '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0',
};
for (const [path, digest] of Object.entries(expected)) {
  const actual = existsSync(resolve(root, path)) ? sha(path) : null;
  check(`canonical:${path}`, actual === digest, { expected: digest, actual });
}

let gitStatus = null;
let gitHead = null;
try {
  gitStatus = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).trim();
  gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  check('workspace-clean', gitStatus.length === 0, { changedEntries: gitStatus ? gitStatus.split(/\r?\n/).length : 0 });
} catch (error) {
  check('workspace-clean', false, { error: error instanceof Error ? error.message : String(error) });
}

try {
  const classification = JSON.parse(execFileSync(
    process.execPath,
    [resolve(root, 'scripts/classify-rc-workspace.mjs')],
    { cwd: root, encoding: 'utf8' },
  ));
  check('workspace-items-classified', classification.unclassifiedWorkspaceItems === 0, {
    unclassifiedWorkspaceItems: classification.unclassifiedWorkspaceItems,
    totalEntries: classification.totalEntries,
  });
  check('temporary-release-residue', classification.temporaryReleaseResidue === 0, {
    temporaryReleaseResidue: classification.temporaryReleaseResidue,
  });
  check('workspace-secret-risk', classification.secretRiskUnresolved === 0, {
    secretRiskUnresolved: classification.secretRiskUnresolved,
  });
} catch (error) {
  check('workspace-items-classified', false, { error: error instanceof Error ? error.message : String(error) });
}

try {
  const websiteRoot = resolve(root, 'agmcockpit-website');
  const safeDirectory = websiteRoot.replaceAll('\\', '/');
  const websiteStatus = execFileSync(
    'git',
    ['-c', `safe.directory=${safeDirectory}`, '-C', websiteRoot, 'status', '--porcelain=v1', '--untracked-files=all'],
    { encoding: 'utf8' },
  ).trim();
  check('website-workspace-clean', websiteStatus.length === 0, {
    changedEntries: websiteStatus ? websiteStatus.split(/\r?\n/).length : 0,
  });
} catch (error) {
  check('website-workspace-clean', false, { error: error instanceof Error ? error.message : String(error) });
}

check('lockfile-present', existsSync(resolve(root, 'pnpm-lock.yaml')), { sha256: existsSync(resolve(root, 'pnpm-lock.yaml')) ? sha('pnpm-lock.yaml') : null });
const appModule = readFileSync(resolve(root, 'apps/api/src/app.module.ts'), 'utf8');
check('canonical-runtime-registered', /CanonicalAuthorityModule/.test(appModule), {});
check('freshness-runtime-registered', /SourceFreshnessModule/.test(appModule), {});
const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
check('freshness-persistence-schema', ['SourceFreshnessRuntimeState', 'SourceFreshnessAlertLedger', 'SourceFreshnessReviewQueue'].every((name) => schema.includes(`model ${name}`)), {});

const androidBuild = readFileSync(resolve(root, 'apps/web/android/app/build.gradle'), 'utf8');
check('android-release-identity',
  /applicationId\s+["']com\.agm\.cockpit["']/.test(androidBuild)
    && /versionName\s+["']1\.3\.0["']/.test(androidBuild)
    && /versionCode\s+21\b/.test(androidBuild),
  { applicationId: 'com.agm.cockpit', versionName: '1.3.0', versionCode: 21 },
);

const signingNames = ['AGM_ANDROID_RELEASE_KEYSTORE', 'AGM_ANDROID_RELEASE_STORE_PASSWORD', 'AGM_ANDROID_RELEASE_KEY_ALIAS', 'AGM_ANDROID_RELEASE_KEY_PASSWORD'];
const missingSigning = signingNames.filter((name) => !process.env[name]?.trim());
let keystorePresent = false;
if (!missingSigning.length) {
  const configured = process.env.AGM_ANDROID_RELEASE_KEYSTORE;
  const path = isAbsolute(configured) ? configured : resolve(root, configured);
  keystorePresent = existsSync(path) && statSync(path).isFile();
}
check('android-release-signing', missingSigning.length === 0 && keystorePresent, { missing: missingSigning, keystorePresent, secretsPrinted: false });

const aab = 'apps/web/android/app/build/outputs/bundle/release/app-release.aab';
check('android-release-aab', existsSync(resolve(root, aab)), { path: aab, sha256: existsSync(resolve(root, aab)) ? sha(aab) : null });

const localProperties = resolve(root, 'apps/web/android/local.properties');
const sdkFromProperties = existsSync(localProperties)
  ? readFileSync(localProperties, 'utf8').match(/^sdk\.dir=(.+)$/m)?.[1]?.replaceAll('\\\\', '\\')
  : null;
const sdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? sdkFromProperties;
const adb = sdkRoot ? resolve(sdkRoot, 'platform-tools', 'adb.exe') : null;
let physicalDevices = [];
let installedVersion = null;
if (adb && existsSync(adb)) {
  try {
    const lines = execFileSync(adb, ['devices', '-l'], { encoding: 'utf8' }).split(/\r?\n/).slice(1).filter(Boolean);
    physicalDevices = lines.filter((line) => /\sdevice\s/.test(line) && !/^emulator-/i.test(line)).map((line) => line.split(/\s+/)[0]);
    if (physicalDevices.length === 1) {
      const packageInfo = execFileSync(adb, ['-s', physicalDevices[0], 'shell', 'dumpsys', 'package', 'com.agm.cockpit'], { encoding: 'utf8' });
      installedVersion = packageInfo.match(/versionName=([^\s]+)/)?.[1] ?? null;
    }
  } catch {
    physicalDevices = [];
  }
}
check('android-current-physical-device', physicalDevices.length === 1 && installedVersion === '1.3.0', {
  adbPresent: Boolean(adb && existsSync(adb)),
  authorizedPhysicalDevices: physicalDevices.length,
  installedVersion,
  expectedVersion: '1.3.0',
});

const websiteLanguage = readFileSync(resolve(root, 'agmcockpit-website/src/data/language-capability.ts'), 'utf8');
check('website-language-claim-current', /availableInApplication:\s*12/.test(websiteLanguage) && /nextWave:\s*0/.test(websiteLanguage), {});

const passed = checks.every((item) => item.pass);
const report = {
  schemaVersion: 1,
  status: passed ? 'READY_FOR_RELEASE_CANDIDATE_FREEZE' : 'BLOCKED',
  generatedAt: new Date().toISOString(),
  gitHead,
  noMutationPerformed: true,
  checks,
};
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
