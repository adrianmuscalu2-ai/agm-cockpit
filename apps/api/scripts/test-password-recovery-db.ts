import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PasswordRecoveryService } from '../src/auth/password-recovery.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { UsersService } from '../src/users/users.service';

// Uses only an existing local image and a newly created disposable database.
// No network email transport, real user, production URL, or persistent volume.
async function main() {
  const root = path.resolve(__dirname, '../../..');
  const container = `agm-recovery-test-${randomUUID()}`;
  const password = randomBytes(24).toString('hex');
  let prisma: PrismaClient | undefined;
  let started = false;
  let stage = 'START_CONTAINER';
  try {
    let url = process.env.AGM_RECOVERY_TEST_DATABASE_URL;
    if (url) {
      const target = new URL(url);
      assert.equal(process.env.GITHUB_ACTIONS,'true','SERVICE_DATABASE_REQUIRES_ISOLATED_GITHUB_RUNNER');
      assert.ok(['127.0.0.1','localhost'].includes(target.hostname));
      assert.equal(target.pathname,'/agm_recovery_test');
      assert.equal(target.username,'agm_recovery_test');
    } else {
      execFileSync('docker', ['run','--pull=never','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD','-e','POSTGRES_USER=agm_recovery_test','-e','POSTGRES_DB=agm_recovery_test','-p','127.0.0.1::5432','postgres:16-alpine'], {env:{...process.env,POSTGRES_PASSWORD:password},stdio:'pipe',timeout:30000});
      started = true;
      let ready = false;
      for(let attempt=0;attempt<40;attempt++) {
        try { execFileSync('docker',['exec',container,'pg_isready','-U','agm_recovery_test'],{stdio:'pipe',timeout:3000}); ready=true;break; } catch { await new Promise(resolve=>setTimeout(resolve,500)); }
      }
      assert.ok(ready,'DISPOSABLE_DATABASE_NOT_READY');
      const port = execFileSync('docker',['port',container,'5432/tcp'],{encoding:'utf8',timeout:5000}).trim();
      assert.match(port,/^127\.0\.0\.1:\d+$/);
      url = `postgresql://agm_recovery_test:${password}@${port}/agm_recovery_test`;
    }
    stage = 'MIGRATE_DISPOSABLE_DATABASE';
    execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(root,'prisma/schema.prisma')],{cwd:root,env:{...process.env,DATABASE_URL:url},stdio:'pipe',timeout:60000});
    console.log('PASSWORD_RECOVERY_MIGRATIONS=PASS');
    stage = 'EXERCISE_RECOVERY';
    prisma = new PrismaClient({datasources:{db:{url}}});
    const company=await prisma.company.create({data:{companyName:'Recovery test only',countryCode:'DE',defaultCurrencyCode:'EUR'}});
    const oldHash=await bcrypt.hash('old-test-password',4);
    const owner=await prisma.user.create({data:{companyId:company.id,displayName:'Recovery fixture',email:'owner@example.invalid',passwordHash:oldHash}});
    const other=await prisma.user.create({data:{companyId:company.id,displayName:'Unchanged fixture',email:'other@example.invalid',passwordHash:oldHash}});
    const role=await prisma.role.create({data:{companyId:company.id,code:'company_owner',displayName:'Owner'}});
    await prisma.userRole.create({data:{companyId:company.id,userId:owner.id,roleId:role.id}});
    const secret=randomBytes(48).toString('hex');
    const jwt=new JwtService({secret,signOptions:{expiresIn:'1h'}});
    const auth=new AuthService(new UsersService(prisma as never),jwt,prisma as never);
    const before=await auth.login(owner.email,'old-test-password');
    const existingRoles=await prisma.userRole.findMany({where:{userId:owner.id}});
    let body='';
    const recovery=new PasswordRecoveryService(prisma as never,{configured:()=>true,send:async(message:{bodyText:string})=>{body=message.bodyText;return {status:'sent'};}} as never);
    await recovery.request(owner.email);
    for(let attempt=0;attempt<20;attempt++) {
      if(await prisma.passwordResetChallenge.count({where:{userId:owner.id,deliveredAt:{not:null}}}))break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    const token=body.match(/#password-reset=([A-Za-z0-9_-]{43})/)?.[1];
    assert.ok(token,'RECOVERY_LINK_MISSING');
    const results=await Promise.allSettled([recovery.confirm(token,'new-test-password-A'),recovery.confirm(token,'new-test-password-B')]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1,'EXACTLY_ONE_CONCURRENT_RESET_MUST_SUCCEED');
    const winner=results[0].status==='fulfilled'?'new-test-password-A':'new-test-password-B';
    await assert.rejects(recovery.confirm(token,winner));
    await assert.rejects(auth.refresh(before.rawRefreshToken));
    await assert.rejects(auth.login(owner.email,'old-test-password'));
    const strategy=new JwtStrategy(new ConfigService({JWT_SECRET:secret}),new UsersService(prisma as never));
    await assert.rejects(strategy.validate(await jwt.verifyAsync(before.accessToken)));
    const after=await auth.login(owner.email,winner);
    await strategy.validate(await jwt.verifyAsync(after.accessToken));
    assert.deepEqual(after.user.roles,['company_owner']);
    assert.deepEqual(await prisma.userRole.findMany({where:{userId:owner.id}}),existingRoles);
    assert.equal((await prisma.user.findUniqueOrThrow({where:{id:other.id}})).passwordHash,oldHash);
    assert.equal(await prisma.user.count({where:{companyId:company.id}}),2);
    assert.equal(await prisma.auditEvent.count({where:{companyId:company.id,actionCode:'AUTH_PASSWORD_RECOVERED'}}),1);
    console.log('PASSWORD_RECOVERY_SINGLE_USE_CONCURRENCY_AND_ACCOUNT_ISOLATION=PASS');

    // A refresh racing with recovery must not leave a usable successor session.
    const raceToken=randomBytes(32).toString('base64url');
    await prisma.passwordResetChallenge.create({data:{userId:owner.id,companyId:company.id,credentialVersion:1,tokenHash:createHash('sha256').update(raceToken).digest('hex'),deliveredAt:new Date(),expiresAt:new Date(Date.now()+60000)}});
    const race=await Promise.allSettled([auth.refresh(after.rawRefreshToken),recovery.confirm(raceToken,'final-test-password')]);
    assert.equal(race[1].status,'fulfilled');
    if(race[0].status==='fulfilled')await assert.rejects(auth.refresh(race[0].value.rawRefreshToken));
    await assert.rejects(auth.refresh(after.rawRefreshToken));
    assert.equal(await prisma.authSession.count({where:{userId:owner.id,revokedAt:null}}),0);
    console.log('PASSWORD_RECOVERY_REFRESH_RACE=PASS');
  } catch (error) {
    const detail = error as { stderr?:Buffer; message?:string; code?:string; signal?:string };
    console.error(JSON.stringify({ stage, code:detail.code, signal:detail.signal, detail:String(detail.stderr?.length ? detail.stderr : detail.message ?? 'UNKNOWN').replaceAll(password,'<redacted>').slice(-2000) }));
    throw error;
  } finally {
    await prisma?.$disconnect();
    if(started)execFileSync('docker',['stop','--time','3',container],{stdio:'pipe',timeout:15000});
  }
}
main().catch(()=>{console.error('PASSWORD_RECOVERY_DATABASE_TEST=FAIL');process.exitCode=1;});
