import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PasswordRecoveryService } from '../src/auth/password-recovery.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { ConfigService } from '@nestjs/config';

const user = { id:'c90e3c52-96da-4045-bb57-77e7935bec91', companyId:'a7ef2038-8149-4ed2-9ab4-69973f4df408', email:'owner@example.test', credentialVersion:0 };
const token = 'a'.repeat(43);
const digest = (value:string) => createHash('sha256').update(value).digest('hex');
const delivered = () => ({ id:'reset-1', userId:user.id, companyId:user.companyId, credentialVersion:0, deliveredAt:new Date(), consumedAt:null, expiresAt:new Date(Date.now()+60_000) });

function fixture() {
  const prisma = {
    user:{ findMany:jest.fn().mockResolvedValue([user]), updateMany:jest.fn().mockResolvedValue({ count:1 }) },
    passwordResetChallenge:{
      findFirst:jest.fn().mockResolvedValue(null), create:jest.fn().mockResolvedValue({ id:'reset-1' }),
      update:jest.fn().mockResolvedValue({}), findUnique:jest.fn().mockResolvedValue(delivered()), updateMany:jest.fn().mockResolvedValue({ count:1 }),
    },
    authSession:{ updateMany:jest.fn().mockResolvedValue({ count:2 }) },
    auditEvent:{ create:jest.fn().mockResolvedValue({}) },
    $transaction:jest.fn(),
  };
  prisma.$transaction.mockImplementation(callback=>callback(prisma));
  const email = { configured:jest.fn().mockReturnValue(true), send:jest.fn().mockResolvedValue({ providerMessageId:'mail-1', status:'sent' }) };
  const service = new PasswordRecoveryService(prisma as never,email as never);
  return { prisma,email,service };
}

describe('Official password recovery',()=>{
  it('sends only to the unique active registered address, using a fragment link and a digest at rest',async()=>{
    const {prisma,email,service}=fixture();
    expect(await service.request(' OWNER@example.test ')).toEqual({ accepted:true });
    await new Promise(resolve=>setImmediate(resolve));
    const message=email.send.mock.calls[0][0];
    expect(message.to).toBe(user.email);
    const secret=message.bodyText.match(/#password-reset=([A-Za-z0-9_-]{43})/)[1];
    expect(message.bodyText).toContain('https://app.agmcockpit.com/access#password-reset=');
    expect(prisma.passwordResetChallenge.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({tokenHash:digest(secret),credentialVersion:0})}));
    expect(JSON.stringify(prisma.passwordResetChallenge.create.mock.calls)).not.toContain(secret);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({status:'Active',company:{isActive:true}}),take:2}));
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.passwordResetChallenge.update).toHaveBeenCalledWith({where:{id:'reset-1'},data:{deliveredAt:expect.any(Date)}});
  });

  it.each([[[]],[[user,{...user,id:'duplicate'}]]])('does not disclose missing or ambiguous accounts',async candidates=>{
    const {prisma,email,service}=fixture();prisma.user.findMany.mockResolvedValue(candidates);
    expect(await service.request('nobody@example.test')).toEqual({accepted:true});
    expect(email.send).not.toHaveBeenCalled();expect(prisma.passwordResetChallenge.create).not.toHaveBeenCalled();
  });

  it('does not couple the public response to sender latency and never logs a provider secret',async()=>{
    const {email,service,prisma}=fixture();
    let rejectDelivery!:(reason:Error)=>void;
    email.send.mockImplementation(()=>new Promise((_resolve,reject)=>{rejectDelivery=reject;}));
    const log=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>undefined);
    expect(await service.request(user.email)).toEqual({accepted:true});
    rejectDelivery(new Error('provider-body-with-credential'));
    await new Promise(resolve=>setImmediate(resolve));
    expect(JSON.stringify(log.mock.calls)).not.toContain('provider-body-with-credential');
    expect(prisma.passwordResetChallenge.update).toHaveBeenCalledWith({where:{id:'reset-1'},data:{consumedAt:expect.any(Date)}});
    log.mockRestore();
  });

  it('refuses an unavailable sender before looking up any identity',async()=>{
    const {email,service,prisma}=fixture();email.configured.mockReturnValue(false);
    await expect(service.request(user.email)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('limits requests for an existing account without changing the public result',async()=>{
    const {service,prisma,email}=fixture();prisma.passwordResetChallenge.findFirst.mockResolvedValue({id:'recent'});
    expect(await service.request(user.email)).toEqual({accepted:true});expect(email.send).not.toHaveBeenCalled();
  });

  it('atomically changes only the password version, consumes links, revokes refresh sessions, and audits without credentials',async()=>{
    const {service,prisma}=fixture();
    expect(await service.confirm(token,'a-new-password')).toEqual({passwordChanged:true,signInRequired:true});
    const data=prisma.user.updateMany.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(['credentialVersion','passwordHash']);
    expect(await bcrypt.compare('a-new-password',data.passwordHash)).toBe(true);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({where:{userId:user.id,companyId:user.companyId,revokedAt:null},data:{revokedAt:expect.any(Date)}});
    expect(prisma.passwordResetChallenge.findUnique).toHaveBeenCalledWith({where:{tokenHash:digest(token)}});
    const audit=JSON.stringify(prisma.auditEvent.create.mock.calls);
    expect(audit).toContain('AUTH_PASSWORD_RECOVERED');expect(audit).not.toContain(token);expect(audit).not.toContain('a-new-password');
  });

  it.each([null,{...delivered(),consumedAt:new Date()},{...delivered(),deliveredAt:null},{...delivered(),expiresAt:new Date(0)}])('rejects missing, replayed, undelivered, and expired links',async challenge=>{
    const {service,prisma}=fixture();prisma.passwordResetChallenge.findUnique.mockResolvedValue(challenge);
    await expect(service.confirm(token,'a-new-password')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed if a competing reset already changed the credential version',async()=>{
    const {service,prisma}=fixture();prisma.user.updateMany.mockResolvedValue({count:0});
    await expect(service.confirm(token,'a-new-password')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a short PIN and passwords that bcrypt would silently truncate',async()=>{
    const {service,prisma}=fixture();
    await expect(service.confirm(token,'1234')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.confirm(token,'é'.repeat(37))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('invalidates existing user access JWTs when the credential version changes',async()=>{
    const users={findById:jest.fn().mockResolvedValue({...user,status:'Active',credentialVersion:1,roles:[]})};
    const strategy=new JwtStrategy(new ConfigService({JWT_SECRET:'s'.repeat(48)}),users as never);
    await expect(strategy.validate({sub:user.id,companyId:user.companyId,roles:[],scope:'user'})).rejects.toThrow();
    await expect(strategy.validate({sub:user.id,companyId:user.companyId,roles:[],scope:'user',credentialVersion:0})).rejects.toThrow();
    await expect(strategy.validate({sub:user.id,companyId:user.companyId,roles:[],scope:'user',credentialVersion:1})).resolves.toMatchObject({userId:user.id});
  });
});
