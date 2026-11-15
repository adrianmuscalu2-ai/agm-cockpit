import {createHash} from 'node:crypto';
import {LunaProductionAccessGuard,VERIFIED_LUNA_COMMANDER} from '../src/agmatcc-copilot/luna-production-access.guard';
import {AgmatccCopilotController} from '../src/agmatcc-copilot/agmatcc-copilot.controller';
describe('Production Luna Commander gate',()=>{
 const previous=process.env.NODE_ENV;
 beforeEach(()=>{process.env.NODE_ENV='production';});afterAll(()=>{process.env.NODE_ENV=previous;});
 const family='test-family';const hash=createHash('sha256').update(family).digest('hex');
 const header='Bearer header.'+Buffer.from(JSON.stringify({familyId:family})).toString('base64url')+'.fixture';
 function setup(roles=['TURN_ADMIN_SESSION'],binding=hash,enabled='true'){
  const request:any={user:{roles},headers:{authorization:header}};
  const verify=jest.fn().mockResolvedValue(undefined);
  const config={get:(k:string)=>({AGMATCC_LUNA_PRODUCTION_ENABLED:enabled,AGMATCC_LUNA_COMMANDER_FAMILY_SHA256:binding})[k]};
  const guard=new LunaProductionAccessGuard(config as never,{requireOperationalAccess:verify} as never);
  return{request,verify,run:()=>guard.canActivate({switchToHttp:()=>({getRequest:()=>request})} as never)};
 }
 it('requires existing verified TURN authentication before accepting exact family',async()=>{
  const s=setup();expect(await s.run()).toBe(true);expect(s.verify).toHaveBeenCalledWith(header);expect(s.request[VERIFIED_LUNA_COMMANDER]).toEqual({familyHash:hash});
 });
 it('rejects revoked/expired/invalid sessions even with matching family bytes',async()=>{
  const s=setup();s.verify.mockRejectedValue(new Error('canonical verifier refused'));await expect(s.run()).rejects.toThrow('canonical verifier refused');expect(s.request[VERIFIED_LUNA_COMMANDER]).toBeUndefined();
 });
 it('does not grant Production Luna to Premium or OWNER alone',async()=>{const s=setup(['PREMIUM_ACCESS','OWNER']);await expect(s.run()).rejects.toThrow('LUNA_COMMANDER_SESSION_REQUIRED');expect(s.verify).not.toHaveBeenCalled();});
 it('rejects another valid TURN family',async()=>{await expect(setup(['TURN_ADMIN_SESSION'],'0'.repeat(64)).run()).rejects.toThrow('LUNA_COMMANDER_BINDING_MISMATCH');});
 it('fails closed without configured binding or activation',async()=>{await expect(setup(['TURN_ADMIN_SESSION'],'').run()).rejects.toThrow('LUNA_COMMANDER_BINDING_MISMATCH');await expect(setup(['TURN_ADMIN_SESSION'],hash,'false').run()).rejects.toThrow('LUNA_COMMANDER_SESSION_REQUIRED');});
 it('exposes only the authenticated caller family fingerprint and never grants activation',()=>{
  const c=new AgmatccCopilotController({} as never);
  const ctx={roles:['TURN_ADMIN_SESSION'],companyId:'fixture',userId:'turn-admin-session',requestId:'r',correlationId:'c'};
  const response=c.session(ctx,header);
  expect(response.data).toEqual({familySha256:hash,activationGranted:false});
  expect(()=>c.session({...ctx,roles:['OWNER']},header)).toThrow('LUNA_COMMANDER_SESSION_REQUIRED');
  expect(JSON.stringify(response)).not.toContain(header);
 });
});
