import {
  formatLinguisticResourceEvidence,
  type LinguisticResourceCounts,
} from '@agm/shared';

export type PremiumLinguisticHeartbeatEvidence = {
  language: string;
  counts: LinguisticResourceCounts;
  errors: readonly unknown[];
  journalStatus: string;
};

export function createPremiumLinguisticHeartbeatDetail(input: PremiumLinguisticHeartbeatEvidence) {
  return formatLinguisticResourceEvidence({
    ...input,
    errors: input.errors.length,
  });
}
