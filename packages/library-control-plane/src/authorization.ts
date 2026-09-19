import type {
  AgmLibraryDomain,
  AgmLibrarySourceId,
  LibraryAuthorizationDecision,
  LibraryAuthorizationPort,
} from './contracts';

export type LibraryAuthorizationRule = {
  role: string;
  domain: AgmLibraryDomain;
  source: AgmLibrarySourceId;
  allowedPayloadFields: readonly string[];
};

export class ExplicitLibraryAuthorizationPolicy implements LibraryAuthorizationPort {
  constructor(private readonly rules: readonly LibraryAuthorizationRule[], private readonly policyVersion = 'agm-library.phase1') {}

  async authorize(input: Parameters<LibraryAuthorizationPort['authorize']>[0]): Promise<LibraryAuthorizationDecision> {
    const rule = this.rules.find((candidate) => candidate.domain === input.domain
      && candidate.source === input.source.source
      && input.request.identity.roles.includes(candidate.role));
    const evidenceRef = `policy:${this.policyVersion}:${input.domain}:${input.source.source}:${input.request.requestId}`;
    if (!rule) return { decision: 'DENIED', authorityGranted: false, reasonCode: 'DENY_BY_DEFAULT', evidenceRef, allowedPayloadFields: [] };
    return { decision: 'GRANTED', authorityGranted: true, reasonCode: 'EXPLICIT_ROLE_SOURCE_ALLOW', evidenceRef, allowedPayloadFields: [...rule.allowedPayloadFields] };
  }
}
