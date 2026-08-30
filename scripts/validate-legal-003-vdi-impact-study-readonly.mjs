import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const ROOT = process.cwd();
const STUDY = 'AGM_LIBRARY/PHASE3/LEGAL_003_VDI_IMPACT_STUDY/IMPACT_STUDY.json';
const REPORT = 'AGM_LIBRARY/PHASE3/LEGAL_003_VDI_IMPACT_STUDY/REPORT.md';
const REGISTRY = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const LEGAL_VIEW = 'AGM_LIBRARY/VIEWS/legislation-safety.view.json';
const ROUTING_VIEW = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const CAR_MOVER_I18N = 'apps/web/src/car-mover/car-mover.i18n.ts';
const LOAD_RECOMMENDATION_PROVIDER = 'apps/api/src/premium-load-safety/securing-recommendation/securing-recommendation.provider.ts';
const LOAD_RECOMMENDATION_VALIDATION = 'apps/api/src/premium-load-safety/securing-recommendation/securing-recommendation.validation.ts';
const LOAD_FIELD_PROVIDER = 'apps/api/src/premium-load-safety/field-test/field-test.provider.ts';
const COPILOT_CONTRACT = 'apps/web/src/premium-copilot/premium-copilot.contract.ts';

const checks = [];
const check = (name, condition, details = undefined) => {
  if (!condition) throw new Error(`FAIL:${name}${details ? `:${details}` : ''}`);
  checks.push({ name, status: 'PASS', ...(details ? { details } : {}) });
};
const read = (path) => readFileSync(`${ROOT}/${path}`);
const text = (path) => read(path).toString('utf8');
const json = (path) => JSON.parse(text(path));
const sha = (path) => createHash('sha256').update(read(path)).digest('hex');

const study = json(STUDY);
const report = text(REPORT);
const registry = json(REGISTRY);
const legalView = json(LEGAL_VIEW);
const routingView = json(ROUTING_VIEW);

check('STUDY_SCHEMA', study.schemaVersion === 'agm-legal003-vdi-impact-study.v1');
check('NO_LICENSED_CONTENT_ACCESS', study.documentUnderAssessment.contentAccessed === false);
check('METADATA_ONLY', study.documentUnderAssessment.metadataOnly === true);
check('FUNCTIONAL_MATRIX_MINIMUM', study.functionalImpact.length >= 14, String(study.functionalImpact.length));
check('DEPENDENCY_VOCABULARY', study.functionalImpact.every((item) => ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(item.dependency)));
check('OWN_WHEELS_NONE', study.functionalImpact.find((item) => item.function === 'Car Mover - vehicle driven on its own wheels')?.dependency === 'NONE');
check('TRANSPORTER_NORMATIVE_CRITICAL', study.functionalImpact.find((item) => item.function.startsWith('Autotransporter carrying passenger/light'))?.dependency === 'CRITICAL');
check('COMPLIANCE_CRITICAL', study.functionalImpact.find((item) => item.function === 'Compliance decision support')?.dependency === 'CRITICAL');
check('FOUR_ARCHITECTURES', study.architectureOptions.length === 4);
check('HYBRID_RECOMMENDED', study.recommendation.preferredArchitecture === 'C_HYBRID_SAFETY_MODEL_WITH_A_EXTERNAL_REFERENCE');
check('PURCHASE_NOT_JUSTIFIED_NOW', study.recommendation.purchaseJustifiedNow === false);
check('LEGACY_3_OF_4_PRESERVED', study.recommendation.closureRecommendation.includes('Preserve 3/4'));
check('SAFETY_STATES', ['PUBLIC_LEGAL_GUIDANCE', 'LICENSED_STANDARD_REFERENCE_REQUIRED', 'HUMAN_VERIFICATION_REQUIRED', 'INSUFFICIENT_AUTHORITY', 'UNKNOWN'].every((state) => state in study.safetyBoundary.allowedStates));
check('UNKNOWN_NOT_SAFE', study.safetyBoundary.forbiddenOutputs.some((item) => item.includes('UNKNOWN converted')));
check('NO_VDI_COMPLIANCE', study.safetyBoundary.forbiddenOutputs.some((item) => item.includes('VDI COMPLIANT')));
check('REGISTRY_COUNT_UNCHANGED', registry.sources.length === study.baseline.centralRegistry.count, String(registry.sources.length));
check('REGISTRY_HASH_UNCHANGED', sha(REGISTRY) === study.baseline.centralRegistry.sha256, sha(REGISTRY));
check('LEGAL_VIEW_COUNT_UNCHANGED', legalView.sourceCount === study.baseline.legislationSafetyView.count, String(legalView.sourceCount));
check('LEGAL_VIEW_HASH_UNCHANGED', sha(LEGAL_VIEW) === study.baseline.legislationSafetyView.sha256, sha(LEGAL_VIEW));
check('ROUTING_VIEW_COUNT_UNCHANGED', routingView.sourceCount === study.baseline.routingTollView.count, String(routingView.sourceCount));
check('ROUTING_VIEW_HASH_UNCHANGED', sha(ROUTING_VIEW) === study.baseline.routingTollView.sha256, sha(ROUTING_VIEW));
check('NO_MUTATION_GUARDRAILS', study.guardrails.registryMutation === 'NONE' && study.guardrails.viewMutation === 'NONE' && study.guardrails.authorityPromotion === 'NONE');
check('NO_PURCHASE_INGEST_APPLY', study.guardrails.purchase === 'NOT_EXECUTED' && study.guardrails.licensedContentIngest === 'NOT_EXECUTED' && study.guardrails.atomicApply === 'NOT_EXECUTED');
check('REPORT_HAS_MODE_SEPARATION', report.includes('Separarea modurilor Car Mover'));
check('REPORT_HAS_DECISION', report.includes('Decizia recomandată Product Owner'));
check('PRODUCT_CAR_MOVER_OWN_WHEELS', text(CAR_MOVER_I18N).includes('Move vehicles on their own wheels'));
check('PRODUCT_NO_LEGAL_COMPLIANCE_CLAIM', text(LOAD_RECOMMENDATION_PROVIDER).includes('never decide, certify safety, or claim legal compliance'));
check('PRODUCT_NORMATIVE_COUNT_NULL', text(LOAD_RECOMMENDATION_VALIDATION).includes('recommendedCount: null'));
check('PRODUCT_NO_INVENTED_TECHNICAL_VALUES', text(LOAD_FIELD_PROVIDER).includes('Never invent counts, LC, STF, weight, friction, angles, capacities, or hidden components'));
check('PRODUCT_NO_BINDING_LEGAL_ADVICE', text(COPILOT_CONTRACT).includes('providesBindingLegalAdvice: false'));

console.log(JSON.stringify({
  validator: 'LEGAL003_VDI_IMPACT_STUDY_READ_ONLY',
  result: 'PASS',
  checksPassed: checks.length,
  checks,
  studySha256: sha(STUDY),
  reportSha256: sha(REPORT),
  mutations: { registry: 'NONE', views: 'NONE', authority: 'NONE', runtimeProduction: 'NO_CHANGE' }
}, null, 2));
