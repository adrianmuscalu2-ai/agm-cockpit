import {LunaAcpmLedger} from '../src/agmatcc-copilot/luna-acpm-ledger';
describe('Production budget activation boundary',()=>{
 const keys=['NODE_ENV','DATABASE_URL','AGMATCC_LUNA_PRODUCTION_ENABLED','AGMATCC_LUNA_PRODUCTION_DB_HOST'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const ctx={companyId:'fixture',userId:'fixture',roles:[],requestId:'r',correlationId:'c'};
 beforeEach(()=>{process.env.NODE_ENV='production';process.env.DATABASE_URL='postgresql://fixture@agm-postgres:5432/agm';process.env.AGMATCC_LUNA_PRODUCTION_DB_HOST='agm-postgres';process.env.AGMATCC_LUNA_PRODUCTION_ENABLED='true';});
 afterAll(()=>{for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}});
 it('rejects missing enablement and rehearsal URL before any database write',async()=>{
  const p={$transaction:jest.fn()};const ledger=new LunaAcpmLedger(p as never);
  process.env.AGMATCC_LUNA_PRODUCTION_ENABLED='false';await expect(ledger.reserve(ctx,'e','m')).rejects.toThrow('LUNA_PRODUCTION_TARGET_REQUIRED');
  process.env.AGMATCC_LUNA_PRODUCTION_ENABLED='true';process.env.DATABASE_URL='postgresql://fixture@127.0.0.1:55432/agm_cockpit_191_rehearsal';await expect(ledger.reserve(ctx,'e','m')).rejects.toThrow('LUNA_PRODUCTION_TARGET_REQUIRED');expect(p.$transaction).not.toHaveBeenCalled();
 });
 it('requires a handoff even when target/activation configuration matches',async()=>{
  const tx={$executeRaw:jest.fn().mockResolvedValue(0),$queryRaw:jest.fn().mockResolvedValue([])};
  const p={$transaction:async(fn:any)=>fn(tx)};
  await expect(new LunaAcpmLedger(p as never).reserve(ctx,'e','m')).rejects.toThrow('LUNA_VERIFIED_HANDOFF_REQUIRED');
  // Only SET LOCAL executes; no reservation INSERT is reached.
  expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
 });
});
