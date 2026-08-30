import {
  premiumContextSources,
  type PremiumContextAnalysisRequest,
  type PremiumContextFinding,
} from './premium-context-analysis.contract';

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/;
const allowedLanguages = new Set(['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq', 'it', 'es', 'sv']);

export type PremiumContextValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validatePremiumContextAnalysisRequest(
  request: PremiumContextAnalysisRequest,
): PremiumContextValidationResult {
  if (!idPattern.test(request.id)) return invalid('invalid-request-id');
  if (!premiumContextSources.includes(request.source)) return invalid('unsupported-source');
  if (!allowedLanguages.has(request.language)) return invalid('unsupported-language');
  if (!request.content.trim() || request.content.length > 10_000) return invalid('invalid-content');
  if (request.contextRefs.length > 32 || request.contextRefs.some((ref) => !ref.trim() || ref.length > 256)) {
    return invalid('invalid-context-refs');
  }
  if (request.usesPersonalData) return invalid('personal-data-not-allowed');
  if (request.producesExternalEffect) return invalid('external-effect-not-allowed');
  return { valid: true };
}

export function validatePremiumContextAnalysisFindings(
  findings: readonly PremiumContextFinding[],
): PremiumContextValidationResult {
  if (findings.length === 0 || findings.length > 50) return invalid('invalid-findings-count');
  const ids = new Set<string>();
  for (const finding of findings) {
    if (!idPattern.test(finding.id) || ids.has(finding.id)) return invalid('invalid-finding-id');
    ids.add(finding.id);
    if (!finding.summary.trim() || finding.summary.length > 2_000) return invalid('invalid-summary');
    if (!Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1) {
      return invalid('invalid-confidence');
    }
    if (finding.requiresUserConfirmation !== true) return invalid('confirmation-required');
    if (finding.sourceRefs.length === 0 || finding.sourceRefs.some((ref) => !ref.trim() || ref.length > 256)) {
      return invalid('missing-source-traceability');
    }
  }
  return { valid: true };
}

function invalid(reason: string): PremiumContextValidationResult {
  return { valid: false, reason };
}
