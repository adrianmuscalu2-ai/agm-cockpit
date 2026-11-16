import { OperationalAgentDutyRunner } from '../src/authority-control-plane/operational-agent-duty.runner';
describe('ACPM observation never controls Guardian authority', () => {
 const ctx={companyId:'fixture',userId:'fixture',roles:[],requestId:'fixture',correlationId:'fixture'};
 for(const failure of ['STARTED','COMPLETED']) it(`preserves Guardian duty when ${failure} persistence fails`,async()=>{
  const snapshot=jest.fn(()=>({overallStatus:'CONFIGURED',secrets:[],contract:'test-redacted',checkedAt:new Date().toISOString()}));
  const emit=jest.fn(async(kind:string)=>{if(kind===failure)throw new Error('ACPM_PERSISTENCE_FAILED');});
  const session=jest.fn((_ctx:unknown,_identity:unknown)=>({emit}));
  const prisma={authorityAuditJournal:{create:jest.fn(async({data})=>data)},agentRuntimeEvent:{create:jest.fn(async({data})=>data)}};
  const runner=new OperationalAgentDutyRunner(prisma as never,{snapshot} as never,{} as never,{session} as never);
  const [result]=await runner.execute(ctx,[{id:'mandate',agentId:'agm.guardian.secrets'}],'run',new Set(['agm.guardian.secrets']));
  expect(snapshot).toHaveBeenCalledTimes(1);expect(result.passed).toBe(true);
  expect(prisma.agentRuntimeEvent.create).toHaveBeenCalledTimes(1);
  expect(session.mock.calls[0][1]).toMatchObject({componentKind:'GUARDIAN',departmentId:'security'});
  if(failure==='STARTED')expect(emit).toHaveBeenCalledTimes(1);
 });
 it('does not fabricate a successful Guardian verdict',async()=>{
  const snapshot=jest.fn(()=>({overallStatus:'ATTENTION',secrets:[],contract:'fixture',checkedAt:new Date().toISOString()}));
  const emit=jest.fn(async(_kind:string)=>{});
  const prisma={authorityAuditJournal:{create:jest.fn(async({data})=>data)},agentRuntimeEvent:{create:jest.fn(async({data})=>data)}};
  const runner=new OperationalAgentDutyRunner(prisma as never,{snapshot} as never,{} as never,{session:()=>({emit})} as never);
  const [result]=await runner.execute(ctx,[{id:'mandate',agentId:'agm.guardian.secrets'}],'run',new Set(['agm.guardian.secrets']));
  expect(result.passed).toBe(false);expect(result.reason).toBe('SECRET_CUSTODY_ATTENTION');
  expect(emit.mock.calls.at(-1)?.[0]).toBe('FAILED');
 });
});
