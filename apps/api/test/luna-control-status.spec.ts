import { ConfigService } from '@nestjs/config';
import { AgmatccCopilotService } from '../src/agmatcc-copilot/agmatcc-copilot.service';
import { AgmatccCopilotController } from '../src/agmatcc-copilot/agmatcc-copilot.controller';

describe('Luna read-only control diagnostics', () => {
  const previous = process.env.NODE_ENV;
  beforeEach(() => { process.env.NODE_ENV = 'production'; });
  afterAll(() => { process.env.NODE_ENV = previous; });
  const family = 'a'.repeat(64);
  function setup(values: Record<string,string> = {}) {
    const complete = jest.fn(), reserve = jest.fn();
    const service = new AgmatccCopilotService(new ConfigService(values), {} as never, {} as never,
      { provider: 'openai', complete } as never, { reserve } as never);
    return { service, complete, reserve };
  }
  it('shows missing activation without any database/provider calls or grant', () => {
    const s = setup(); const result = s.service.controlStatus(family);
    expect(result.configurationReady).toBe(false);
    expect(result.checks).toMatchObject({enabled:false,commanderBound:false,targetPinned:false,handoffPinned:false});
    expect(result.activationGranted).toBe(false); expect(result.budgetVerified).toBe(false);
    expect(s.complete).not.toHaveBeenCalled(); expect(s.reserve).not.toHaveBeenCalled();
  });
  it('checks the current caller family and does not expose bindings or pins', () => {
    const s = setup({ AGMATCC_LUNA_PRODUCTION_ENABLED:'true', AGMATCC_LUNA_COMMANDER_FAMILY_SHA256:family,
      AGMATCC_LUNA_PRODUCTION_DB_HOST:'private-db-host', AGMATCC_LUNA_HANDOFF_SHA256:'b'.repeat(64) });
    expect(s.service.controlStatus(family).configurationReady).toBe(true);
    expect(s.service.controlStatus('c'.repeat(64)).configurationReady).toBe(false);
    const output = JSON.stringify(s.service.controlStatus(family));
    expect(output).not.toContain(family); expect(output).not.toContain('private-db-host');
    expect(s.reserve).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled();
  });
  it('does not turn OWNER into Commander for diagnostics', () => {
    const s = setup(); const controller = new AgmatccCopilotController(s.service);
    expect(() => controller.controlStatus({roles:['OWNER']} as never, 'unused')).toThrow('LUNA_COMMANDER_SESSION_REQUIRED');
  });
});
