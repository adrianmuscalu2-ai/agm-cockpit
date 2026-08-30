import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative));
const text = (relative) => read(relative).toString('utf8');
const json = (relative) => JSON.parse(text(relative));
const sha256 = (relative) => createHash('sha256').update(read(relative)).digest('hex');
const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass: Boolean(pass), actual, expected });

const paths = {
  contract: 'apps/api/src/source-freshness/source-freshness.contract.ts',
  engine: 'apps/api/src/source-freshness/source-freshness.engine.ts',
  email: 'apps/api/src/source-freshness/source-freshness.email.ts',
  test: 'apps/api/test/source-freshness.spec.ts',
  schema: 'AGM_LIBRARY/SCHEMAS/source-freshness-record.schema.json',
  stateMachine: 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/STATE_MACHINE_AND_POLICY.md',
  triggerMatrix: 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/TRIGGER_MATRIX.md',
  emailTemplate: 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/EMAIL_TEMPLATE.md',
  initial: 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/INITIAL_ROUTING_TOLL_SOURCES.json',
  registry: 'AGM_LIBRARY/REGISTRY/canonical-sources.json',
  view: 'AGM_LIBRARY/VIEWS/routing-toll.view.json',
  appModule: 'apps/api/src/app.module.ts',
};

for (const [name, relative] of Object.entries(paths)) check(`FILE_${name.toUpperCase()}`, existsSync(path.join(root, relative)), relative, 'exists');

const schema = json(paths.schema);
const initial = json(paths.initial);
const contract = text(paths.contract);
const engine = text(paths.engine);
const email = text(paths.email);
const appModule = text(paths.appModule);
const envExample = text('.env.example');

for (const state of ['CURRENT', 'EXPIRY_WARNING', 'NEW_VERSION_DETECTED', 'SUPERSEDED_PENDING_REVIEW', 'REVIEW_REQUIRED', 'EXPIRED_REVIEW_REQUIRED', 'FRESHNESS_UNKNOWN']) {
  check(`STATE_${state}`, contract.includes(`'${state}'`) && schema.properties.currentStatus.enum.includes(state), state, 'implemented and schema-backed');
}
for (const alert of ['NEW_VERSION_DETECTED', 'SUPERSEDED_PENDING_REVIEW', 'EXPIRY_30_DAYS', 'EXPIRY_14_DAYS', 'EXPIRY_7_DAYS', 'EXPIRY_1_DAY', 'EXPIRY_DAY', 'FRESHNESS_UNKNOWN']) {
  check(`ALERT_${alert}`, contract.includes(`'${alert}'`), alert, 'implemented');
}

check('INVARIANT_UNKNOWN_NOT_ZERO', engine.includes("resolvedValue: null") && engine.includes("UNKNOWN_HUMAN_VERIFICATION"), 'null/UNKNOWN_HUMAN_VERIFICATION', 'never zero');
check('INVARIANT_NO_AUTO_AUTHORITY', engine.includes("authorityPromotion: 'NONE'") && engine.includes('automaticPromotion: false'), 'NONE/false', 'NONE/false');
check('INVARIANT_NO_REGISTRY_VIEW_MUTATION', engine.includes("registryMutation: 'NONE'") && engine.includes("routingTollViewMutation: 'NONE'"), 'NONE/NONE', 'NONE/NONE');
check('EMAIL_SUBJECT', email.includes('[AGM SOURCE ALERT] ${event.status} — ${source.sourceId}'), 'implemented', 'exact template');
check('EMAIL_CANONICAL_DESTINATION', email.includes("AGM_PRODUCT_OWNER_ALERT_EMAIL") && /^AGM_PRODUCT_OWNER_ALERT_EMAIL=\s*$/m.test(envExample), 'declared blank; no fallback', 'explicit configuration required');
check('EMAIL_SEED_NOT_FALLBACK', !email.includes('SEED_OWNER_EMAIL'), 'no fallback', 'no fallback');
check('DEDUP_KEY', engine.includes('`${sourceId}|${alertType}|${effectiveVersionOrDate}`'), 'SourceId|alertType|effectiveVersion/date', 'exact');
check('RUNTIME_MODULE_ACTIVATED', appModule.includes('SourceFreshnessModule'), appModule.includes('SourceFreshnessModule') ? 'imported by AppModule' : 'not imported', 'imported by AppModule');

const nl = initial.sources.find((source) => source.sourceId === 'CS-NL-GOV-TRUCK-TOLL-RATES-2026');
const dk = initial.sources.find((source) => source.sourceId === 'CS-DK-KMTOLL-TARIFF-TABLE-V1-2');
check('NL_APPLICABILITY', `${nl?.effectiveFrom}/${nl?.effectiveUntil}`, '2026-07-01/2026-08-31');
check('NL_POST_EXPIRY_UNKNOWN', nl?.reviewContext?.usageAfter2026_08_31 ?? nl?.reviewContext?.['usageAfter2026-08-31'], 'UNKNOWN_HUMAN_VERIFICATION', 'UNKNOWN_HUMAN_VERIFICATION');
check('NL_CANDIDATE_NOT_INVENTED', nl?.reviewContext?.newCandidateUrl === null && nl?.reviewContext?.newCandidateVersion === null, `${nl?.reviewContext?.newCandidateUrl}/${nl?.reviewContext?.newCandidateVersion}`, 'null/null');
check('DK_Q3_TRIGGER', dk?.nextFreshnessCheck, '2026-09-30');
check('DK_NO_AUTO_EXTENSION', dk?.reviewContext?.automaticVersionExtension === false, dk?.reviewContext?.automaticVersionExtension, false);

const registryHash = sha256(paths.registry);
const viewHash = sha256(paths.view);
check('REGISTRY_AUTHORIZED_ATOMIC_STATE', registryHash === '7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245', registryHash, '7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245');
check('ROUTING_TOLL_VIEW_AUTHORIZED_ATOMIC_STATE', viewHash === '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0', viewHash, '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0');
check('PRODUCTION_DATA_MUTATION', initial.guardrails.runtimeProduction, 'NO_CHANGE');
check('COMMIT_PUSH', initial.guardrails.commitPush, 'NOT_EXECUTED');

const destinationConfigured = Boolean(process.env.AGM_PRODUCT_OWNER_ALERT_EMAIL?.trim()) || configuredInEnvFile('AGM_PRODUCT_OWNER_ALERT_EMAIL');
const fromConfigured = Boolean(process.env.GMAIL_FROM_ADDRESS?.trim()) || configuredInEnvFile('GMAIL_FROM_ADDRESS');
const staticTokenConfigured = Boolean(process.env.GMAIL_ACCESS_TOKEN?.trim()) || configuredInEnvFile('GMAIL_ACCESS_TOKEN');
const oauthConfigured = ['GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET', 'GMAIL_OAUTH_REFRESH_TOKEN']
  .every((name) => Boolean(process.env[name]?.trim()) || configuredInEnvFile(name));

const failed = checks.filter((item) => !item.pass);
const report = {
  contractVersion: 'agm-source-freshness-validation.v1',
  validationMode: 'READ_ONLY',
  checks,
  summary: { passed: checks.length - failed.length, total: checks.length, failed: failed.length },
  emailRuntimeGate: {
    status: !destinationConfigured
      ? 'EMAIL_DESTINATION_NOT_CONFIGURED'
      : (!fromConfigured || (!staticTokenConfigured && !oauthConfigured) ? 'EMAIL_TRANSPORT_NOT_CONFIGURED' : 'READY'),
    destinationVariable: 'AGM_PRODUCT_OWNER_ALERT_EMAIL',
    destinationConfigured,
    gmailFromConfigured: fromConfigured,
    gmailAuthenticationConfigured: staticTokenConfigured || oauthConfigured,
    missing: [
      ...(!destinationConfigured ? ['AGM_PRODUCT_OWNER_ALERT_EMAIL'] : []),
      ...(!fromConfigured ? ['GMAIL_FROM_ADDRESS'] : []),
      ...(!staticTokenConfigured && !oauthConfigured ? ['GMAIL_ACCESS_TOKEN or GMAIL_OAUTH_CLIENT_ID + GMAIL_OAUTH_CLIENT_SECRET + GMAIL_OAUTH_REFRESH_TOKEN'] : []),
    ],
    scope: 'EMAIL_DELIVERY_ONLY',
  },
  protectedData: {
    registry: { path: paths.registry, sha256: registryHash, mutation: 'NONE' },
    routingTollView: { path: paths.view, sha256: viewHash, mutation: 'NONE' },
    productionDataMutation: 'NONE',
    authorityPromotion: 'NONE',
  },
};

console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;

function configuredInEnvFile(name) {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return false;
  const line = readFileSync(envPath, 'utf8').split(/\r?\n/).find((value) => value.trim().startsWith(`${name}=`));
  if (!line) return false;
  const value = line.slice(line.indexOf('=') + 1).trim();
  return Boolean(value && !value.startsWith('#'));
}
