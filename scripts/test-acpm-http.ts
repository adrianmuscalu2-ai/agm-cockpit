import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { Module, ValidationPipe } from '@nestjs/common';
import { PassportModule, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtService } from '@nestjs/jwt';
import { AcpmController, AgentChainPerformanceController } from '../apps/api/src/acpm/acpm.module';
import { AcpmService } from '../apps/api/src/acpm/acpm.service';
import type { RequestContext } from '../apps/api/src/common/request-context';
import type { AppendAcpmEventDto } from '../apps/api/src/acpm/acpm.dto';

export async function runAcpmHttpTests(service:AcpmService,ctx:RequestContext,event:AppendAcpmEventDto) {
  const secret=randomBytes(32).toString('hex'); // ephemeral test-only; never logged or used against production
  class IsolatedStrategy extends PassportStrategy(Strategy,'jwt') {
    constructor(){super({jwtFromRequest:ExtractJwt.fromAuthHeaderAsBearerToken(),secretOrKey:secret,issuer:'acpm-isolated-test'});}
    validate(payload:any){return {...ctx,companyId:payload.companyId,roles:payload.roles};}
  }
  @Module({imports:[PassportModule],controllers:[AcpmController,AgentChainPerformanceController],providers:[{provide:AcpmService,useValue:service},{provide:IsolatedStrategy,useValue:new IsolatedStrategy()}]})
  class IsolatedModule {}
  const app=await NestFactory.create(IsolatedModule,{logger:false});
  app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));
  try{
    await app.listen(0,'127.0.0.1');const url=await app.getUrl();
    const jwt=new JwtService({secret,signOptions:{issuer:'acpm-isolated-test',expiresIn:'1m'}});
    const headers={Authorization:`Bearer ${jwt.sign({companyId:ctx.companyId,roles:ctx.roles})}`};
    assert.equal((await fetch(url+'/acpm')).status,401);
    const legacy=await (await fetch(url+'/agent-chain-performance',{headers})).json();
    const current=await (await fetch(url+'/acpm?componentId='+encodeURIComponent(event.componentId),{headers})).json();
    assert.equal(legacy.data.contract,'agent-chain-performance.v1');assert.equal(current.data.contract,'agent-chain-performance-monitor.v1');
    assert.deepEqual(current.data.runs[0].events,legacy.data.runs.find((r:any)=>r.componentId===event.componentId).events);
    const denied={Authorization:`Bearer ${jwt.sign({companyId:ctx.companyId,roles:[]})}`};
    assert.equal((await fetch(url+'/acpm',{headers:denied})).status,403);
    assert.equal((await fetch(url+'/acpm?from=invalid',{headers})).status,400);
    assert.equal((await fetch(url+'/acpm?from=2026-11-16T00:00:00Z&to=2026-11-15T00:00:00Z',{headers})).status,400);
    assert.equal((await fetch(url+'/acpm/events',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(event)})).status,201);
  }finally{await app.close();}
}
