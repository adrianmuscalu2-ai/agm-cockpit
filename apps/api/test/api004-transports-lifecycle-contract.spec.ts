import {
  getCanonicalLifecycleChain,
  TRANSPORT_LIFECYCLE_CONTRACT,
} from '../src/transports/transport-lifecycle.contract';
import { TRANSPORT_TRANSITION_POLICIES } from '../src/transports/transport-transition.policy';

describe('API-004 Transports Lifecycle contract', () => {
  it('defines one continuous canonical chain from imported to archived', () => {
    const chain = getCanonicalLifecycleChain();
    expect(chain).toHaveLength(10);
    expect(chain[0].from).toBe(TRANSPORT_LIFECYCLE_CONTRACT.initialStateCode);
    expect(chain.at(-1)?.to).toBe(TRANSPORT_LIFECYCLE_CONTRACT.terminalStateCode);

    for (let index = 1; index < chain.length; index += 1) {
      expect(chain[index].from).toBe(chain[index - 1].to);
    }
  });

  it('requires a unique validation and failure contract for every transition', () => {
    const policies = Object.values(TRANSPORT_TRANSITION_POLICIES);
    expect(new Set(policies.map((policy) => policy.validationType)).size).toBe(policies.length);
    expect(new Set(policies.map((policy) => policy.failureErrorCode)).size).toBe(policies.length);
    expect(policies.every((policy) => policy.fromStateCodes.length > 0)).toBe(true);
  });

  it('declares tenant isolation and the protected traceability records', () => {
    expect(TRANSPORT_LIFECYCLE_CONTRACT.tenantKey).toBe('companyId');
    expect(TRANSPORT_LIFECYCLE_CONTRACT.protectedRecords).toEqual([
      'validationReport',
      'auditEvent',
      'stateHistory',
      'financialLedger',
    ]);
  });
});
