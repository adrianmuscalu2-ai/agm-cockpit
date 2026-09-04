import { operationalProfile } from '../src/authority-control-plane/operational-profile';
import { premiumNetworkSeed } from '../src/authority-control-plane/premium-network.seed';

describe('Premium operational telemetry coverage', () => {
  it('classifies every canonical identity without registry-derived runtime', () => {
    const profiles = premiumNetworkSeed.map((node) => ({ node, profile: operationalProfile(node) }));
    expect(profiles).toHaveLength(premiumNetworkSeed.length);
    expect(profiles.every(({ profile }) => profile.expectedSource !== ('REGISTRY' as never))).toBe(true);
    expect(profiles.every(({ profile }) => profile.runtimeMode !== 'CAPABILITY_NOT_IMPLEMENTED' || Boolean(profile.missingCapability && profile.requiredAction))).toBe(true);
  });

  it('binds implemented execution paths to their real stores', () => {
    expect(operationalProfile(premiumNetworkSeed.find((node) => node.canonicalId === 'premium.car-mover.intake-dedup')!).expectedSource).toBe('OPPORTUNITY_TELEMETRY');
    expect(operationalProfile(premiumNetworkSeed.find((node) => node.canonicalId === 'premium.adapters.routing')!).expectedSource).toBe('LIVE_ADAPTER');
    expect(operationalProfile(premiumNetworkSeed.find((node) => node.canonicalId === 'premium.car-mover.job-service')!).expectedSource).toBe('DOMAIN_EVENT_STORE');
    expect(operationalProfile(premiumNetworkSeed.find((node) => node.canonicalId === 'agm.authority.control-plane')!).expectedSource).toBe('COMPONENT_HEARTBEAT');
  });

  it('binds Guardian, inspectors and orchestrator to implemented evaluators or lifecycle events', () => {
    expect(operationalProfile(premiumNetworkSeed.find((node) => node.canonicalId === 'agm.guardian.secrets')!)).toMatchObject({ expectedSource: 'SECRET_TELEMETRY' });
    for (const id of ['premium.architecture-inspector', 'premium.release-inspector', 'premium.orchestrator']) {
      expect(operationalProfile(premiumNetworkSeed.find((node) => node.canonicalId === id)!)).toMatchObject({ expectedSource: 'RUNTIME_EVENT' });
    }
  });
});
