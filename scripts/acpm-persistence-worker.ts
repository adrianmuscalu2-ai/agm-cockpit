import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { AcpmObserver } from '../apps/api/src/acpm/acpm.observer';
import { AcpmService } from '../apps/api/src/acpm/acpm.service';
import type { PrismaService } from '../apps/api/src/prisma/prisma.service';
import type { RequestContext } from '../apps/api/src/common/request-context';

const read=<T>(name:string):T=>JSON.parse(process.env[name]??'null') as T;
async function main(){
  const mode=process.env.ACPM_TEST_WORKER_MODE;
  const db=new PrismaClient();
  const ctx=read<RequestContext>('ACPM_TEST_CONTEXT');
  try {
    if(mode==='append'){
      const input=read<any>('ACPM_TEST_EVENT');
      process.stdout.write(`${JSON.stringify({marker:'WORKER_READY',workerPid:process.pid})}\n`);
      await new Promise<void>(resolve=>process.stdin.once('data',()=>resolve()));
      const result=await new AcpmService(db as PrismaService).append(input,ctx);
      process.stdout.write(`${JSON.stringify({marker:'WORKER_COMMITTED',workerPid:process.pid,...result})}\n`);
      await new Promise<void>(()=>{});
      return;
    }
    if(mode==='crash-native-tx'){
      const input=read<any>('ACPM_TEST_NATIVE_EVENT');
      const observer=new AcpmObserver(db as PrismaService);
      // Reproduce the exact transaction body and pause after both writes but
      // before commit so the parent can kill this process and verify rollback.
      await db.$transaction(async tx=>{
        await tx.$executeRaw`SET LOCAL idle_in_transaction_session_timeout = 0`;
        const event=await tx.agentRuntimeEvent.upsert({
          where:{companyId_eventId:{companyId:ctx.companyId,eventId:input.eventId}},
          create:{companyId:ctx.companyId,...input,occurredAt:new Date(input.occurredAt)},
          update:{},
        });
        await observer.persistNativeInTransaction(tx,ctx,{...event,occurredAt:event.occurredAt.toISOString(),recordedAt:event.recordedAt.toISOString()});
        const backend=await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() AS pid`;
        process.stdout.write(`${JSON.stringify({marker:'TX_OPEN_BEFORE_COMMIT',eventId:event.eventId,workerPid:process.pid,backendPid:backend[0].pid})}\n`);
        await new Promise<void>(resolve=>process.stdin.once('data',()=>resolve()));
      });
      process.stdout.write(`${JSON.stringify({marker:'TX_COMMITTED_UNEXPECTEDLY'})}\n`);
      return;
    }
    throw new Error('ACPM_TEST_WORKER_MODE_INVALID');
  } finally {
    await db.$disconnect();
    // Keep the successful append worker alive until the parent interrupts it.
    if(mode==='append') process.exit(0);
  }
}
main().catch(error=>{process.stderr.write(`${error instanceof Error?error.stack:String(error)}\n`);process.exitCode=1;});
