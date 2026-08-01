import {
  premiumLinguisticCapabilities,
  premiumLinguisticLanguages,
  type PremiumLinguisticProposal,
  type PremiumLinguisticRequest,
} from './premium-linguistic-agents.contract';

export function validatePremiumLinguisticRequest(request: PremiumLinguisticRequest) {
  if (!request.id.trim() || !request.sourceFingerprint.trim()) return 'invalid-request' as const;
  if (!premiumLinguisticLanguages.includes(request.language)) return 'unsupported-language' as const;
  if (!premiumLinguisticCapabilities.includes(request.capability)) return 'unsupported-capability' as const;
  if (request.protectedTerms.some((term) => !term.trim() || term.length > 120)) return 'invalid-protected-term' as const;
  return undefined;
}

export function validatePremiumLinguisticProposal(
  request: PremiumLinguisticRequest,
  proposal: PremiumLinguisticProposal,
) {
  if (
    !proposal.id.trim() ||
    proposal.requestId !== request.id ||
    proposal.language !== request.language ||
    proposal.requiresUserConfirmation !== true ||
    proposal.changes.length === 0 ||
    proposal.changes.length > 50
  ) return 'invalid-proposal' as const;

  for (const change of proposal.changes) {
    if (
      !change.id.trim() ||
      !change.original.trim() ||
      !change.replacement.trim() ||
      change.original.trim() === change.replacement.trim() ||
      change.original.length > 500 ||
      change.replacement.length > 500 ||
      !change.explanation.trim() ||
      change.explanation.length > 700 ||
      !Number.isFinite(change.confidence) ||
      change.confidence < 0 ||
      change.confidence > 1
    ) return 'invalid-change' as const;

    for (const protectedTerm of request.protectedTerms) {
      if (containsTerm(change.original, protectedTerm) && !containsTerm(change.replacement, protectedTerm)) {
        return 'protected-term-changed' as const;
      }
    }
  }
  return undefined;
}

function containsTerm(value: string, term: string) {
  return value.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase());
}
