import { BadRequestException, InternalServerErrorException, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { OpportunityTelemetryInterceptor } from '../src/opportunity-intelligence/opportunity-telemetry.interceptor';

function context(handlerName: string): ExecutionContext {
  const handler = { [handlerName]() { return undefined; } }[handlerName];
  return {
    getHandler: () => handler as never,
    switchToHttp: () => ({ getRequest: () => ({ user: { companyId: '00000000-0000-0000-0000-000000000001' } }) }),
  } as unknown as ExecutionContext;
}

describe('Opportunity failure telemetry', () => {
  it('records STARTED and COMPLETED runtime workload around a real request', async () => {
    const create = jest.fn().mockResolvedValue({});
    const interceptor = new OpportunityTelemetryInterceptor({ opportunityAgentTelemetry: { upsert: jest.fn() }, agentRuntimeEvent: { create } } as never);
    const next = { handle: () => of({ accepted: true }) } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context('copilot'), next))).resolves.toEqual({ accepted: true });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([input]) => input.data.lifecycle)).toEqual(['STARTED', 'COMPLETED']);
    expect(create.mock.calls[0][0].data.dossierId).toBe(create.mock.calls[1][0].data.dossierId);
    expect(create.mock.calls[0][0].data.evidenceRef).toMatch(/^Request:/);
  });

  it('records real analyze request failures for all four participating agents', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({});
    const interceptor = new OpportunityTelemetryInterceptor({ opportunityAgentTelemetry: { upsert }, agentRuntimeEvent: { create } } as never);
    const next = { handle: () => throwError(() => new BadRequestException('OPPORTUNITY_CHAIN_MEMBER_NOT_FOUND')) } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context('analyze'), next))).rejects.toThrow('OPPORTUNITY_CHAIN_MEMBER_NOT_FOUND');

    expect(upsert).toHaveBeenCalledTimes(4);
    expect(upsert.mock.calls.every(([input]) => input.create.health === 'DEGRADED' && input.create.dependencyHealth === 'PASS' && input.create.outputReference === 'failure:OPPORTUNITY_CHAIN_MEMBER_NOT_FOUND')).toBe(true);
    expect(create).toHaveBeenCalledTimes(8);
    expect(create.mock.calls.slice(0, 4).every(([input]) => input.data.lifecycle === 'STARTED')).toBe(true);
    expect(create.mock.calls.slice(4).every(([input]) => input.data.lifecycle === 'FAILED' && input.data.outputRef === 'failure:OPPORTUNITY_CHAIN_MEMBER_NOT_FOUND')).toBe(true);
  });

  it('records server failures as failed dependency health', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({});
    const interceptor = new OpportunityTelemetryInterceptor({ opportunityAgentTelemetry: { upsert }, agentRuntimeEvent: { create } } as never);
    const next = { handle: () => throwError(() => new InternalServerErrorException('DATABASE_UNAVAILABLE')) } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context('copilot'), next))).rejects.toThrow('DATABASE_UNAVAILABLE');

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].create).toMatchObject({ agentId: 'premium.copilot-gateway', health: 'FAIL', dependencyHealth: 'FAIL', outputReference: 'failure:DATABASE_UNAVAILABLE' });
    expect(create.mock.calls.map(([input]) => input.data.lifecycle)).toEqual(['STARTED', 'FAILED']);
  });
});
