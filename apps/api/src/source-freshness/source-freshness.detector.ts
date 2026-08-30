import { Injectable } from '@nestjs/common';
import type { SourceFreshnessObservation, SourceFreshnessRecord } from './source-freshness.contract';

export abstract class SourceFreshnessDetectionHook {
  abstract inspect(source: SourceFreshnessRecord, checkedAt: string): Promise<SourceFreshnessObservation>;
}

/** Default hook is deliberately non-networking. Official-site detectors can be
 * registered later; lack of a relevant due check is evaluated fail-closed. */
@Injectable()
export class MetadataOnlyFreshnessDetectionHook implements SourceFreshnessDetectionHook {
  async inspect(_source: SourceFreshnessRecord, checkedAt: string): Promise<SourceFreshnessObservation> {
    return { checkedAt, checkOutcome: 'NOT_RUN' };
  }
}
