import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { PasswordRecoveryService } from '../src/auth/password-recovery.service';
import { CsrfOriginGuard } from '../src/auth/csrf-origin.guard';

describe('Password recovery HTTP boundary',()=>{
  let app:INestApplication;
  const previous={node:process.env.NODE_ENV,cors:process.env.CORS_ALLOWED_ORIGINS};
  const recovery={request:jest.fn().mockResolvedValue({accepted:true}),confirm:jest.fn().mockResolvedValue({passwordChanged:true,signInRequired:true})};
  beforeAll(async()=>{
    process.env.NODE_ENV='production';process.env.CORS_ALLOWED_ORIGINS='https://app.agmcockpit.com';
    const module=await Test.createTestingModule({controllers:[AuthController],providers:[CsrfOriginGuard,{provide:AuthService,useValue:{}},{provide:PasswordRecoveryService,useValue:recovery}]}).compile();
    app=module.createNestApplication();app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.init();
  });
  afterAll(async()=>{
    await app?.close();
    if(previous.node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous.node;
    if(previous.cors===undefined)delete process.env.CORS_ALLOWED_ORIGINS;else process.env.CORS_ALLOWED_ORIGINS=previous.cors;
  });
  it('accepts an email request without revealing identity or issuing a session',async()=>{
    const response=await request(app.getHttpServer()).post('/auth/password-recovery/request').set('Origin','https://app.agmcockpit.com').send({email:'fixture@example.invalid'}).expect(201).expect('Cache-Control','no-store');
    expect(response.body.data).toEqual({accepted:true});expect(response.headers['set-cookie']).toBeUndefined();
  });
  it.each([undefined,'https://attacker.example.invalid'])('rejects an absent or untrusted browser origin',async origin=>{
    let call=request(app.getHttpServer()).post('/auth/password-recovery/request');if(origin)call=call.set('Origin',origin);
    await call.send({email:'fixture@example.invalid'}).expect(403);expect(recovery.request).not.toHaveBeenCalled();
  });
  it('rejects a malformed email before reaching recovery',async()=>{
    await request(app.getHttpServer()).post('/auth/password-recovery/request').set('Origin','https://app.agmcockpit.com').send({email:'not-an-email'}).expect(400);
    expect(recovery.request).not.toHaveBeenCalled();
  });
  it('rejects the four-digit TURN PIN as a new account password',async()=>{
    await request(app.getHttpServer()).post('/auth/password-recovery/confirm').set('Origin','https://app.agmcockpit.com').send({token:'t'.repeat(43),password:'1234'}).expect(400);
    expect(recovery.confirm).not.toHaveBeenCalled();
  });
  it('never permits role or account selection in the confirmation payload',async()=>{
    await request(app.getHttpServer()).post('/auth/password-recovery/confirm').set('Origin','https://app.agmcockpit.com').send({token:'t'.repeat(43),password:'a-new-test-password',roles:['company_owner'],userId:'other'}).expect(400);
    expect(recovery.confirm).not.toHaveBeenCalled();
  });
  it('clears the old cookie and requires a fresh sign-in after recovery',async()=>{
    const response=await request(app.getHttpServer()).post('/auth/password-recovery/confirm').set('Origin','https://app.agmcockpit.com').send({token:'t'.repeat(43),password:'a-new-test-password'}).expect(201).expect('Cache-Control','no-store');
    expect(response.body.data).toEqual({passwordChanged:true,signInRequired:true});
    expect(response.headers['set-cookie'][0]).toMatch(/agm_refresh=;/);expect(response.body.data.accessToken).toBeUndefined();
  });
});
