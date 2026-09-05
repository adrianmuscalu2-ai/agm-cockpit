import { operationalProfile } from '../src/authority-control-plane/operational-profile';
import { premiumNetworkSeed } from '../src/authority-control-plane/premium-network.seed';
import { RUNTIME_CAPABILITY_REQUIREMENTS, RUNTIME_NATIVE_TELEMETRY_IDS } from '../src/authority-control-plane/authority-control-plane.service';

describe('Premium operational telemetry coverage', () => {
  it('classifies every canonical identity without registry-derived runtime', () => {
    const profiles = premiumNetworkSeed.map((node) => ({ node, profile: operationalProfile(node) }));
    expect(premiumNetworkSeed).toHaveLength(28);
    expect(profiles).toHaveLength(28);
    expect(profiles.every(({ profile }) => profile.expectedSource !== ('REGISTRY' as never))).toBe(true);
    expect(profiles.every(({ profile }) => profile.expectedSource !== ('NONE' as never))).toBe(true);
    expect(profiles.every(({ profile }) => profile.runtimeMode !== 'CAPABILITY_NOT_IMPLEMENTED')).toBe(true);
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

  it('has a real runtime producer or executable capability probe for every non-human identity', () => {
    const covered = new Set([...Object.keys(RUNTIME_CAPABILITY_REQUIREMENTS), ...RUNTIME_NATIVE_TELEMETRY_IDS]);
    const operationalIds = premiumNetworkSeed.filter((node) => node.kind !== 'HUMAN_AUTHORITY').map((node) => node.canonicalId);
    expect(Object.keys(RUNTIME_CAPABILITY_REQUIREMENTS)).toHaveLength(22);
    expect(Object.values(RUNTIME_CAPABILITY_REQUIREMENTS).every((requirement) => requirement.provider && requirement.methods.length > 0)).toBe(true);
    expect(RUNTIME_NATIVE_TELEMETRY_IDS).toHaveLength(5);
    expect(RUNTIME_NATIVE_TELEMETRY_IDS.some((id) => id in RUNTIME_CAPABILITY_REQUIREMENTS)).toBe(false);
    expect([...covered].sort()).toEqual([...operationalIds].sort());
  });
});
