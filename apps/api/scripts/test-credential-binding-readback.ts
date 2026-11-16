import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55432'); assert.equal(url.pathname, '/agm_cockpit_191_rehearsal');
  const db = new PrismaClient();
  try {
    const source = readFileSync('scripts/production-credential-maintenance.py', 'utf8');
    const sql = source.match(/bindings:await t\.\$queryRawUnsafe\("([^"]+)"\)/)![1];
    const rows = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE credential_binding_readback (actor_id text,principal_id text,status text,company_id text,principal_type text,binding_id integer) ON COMMIT DROP');
      for (const [id, subject, laterActor, laterStatus] of [
        ['3bca0eb6-2051-4c35-89d4-cafe5082c3ab', 'premium.architecture-inspector', 'different-actor', 'BOUND'],
        ['dca5cb02-72f0-4837-8ba8-31cbdb05ddee', 'premium.recovery-executor', 'premium.recovery-executor', 'REVOKED'],
      ]) {
        await tx.$executeRaw`INSERT INTO credential_binding_readback VALUES (${subject},${id},'BOUND','fixture','MACHINE_IDENTITY',1),(${laterActor},${id},${laterStatus},'fixture','MACHINE_IDENTITY',2)`;
      }
      return tx.$queryRawUnsafe<Array<{ actor_id: string; status: string }>>(sql.replace('agm_governance.actor_identity_bindings', 'credential_binding_readback'));
    });
    assert(rows.some(r => r.actor_id === 'different-actor'));
    assert(rows.some(r => r.status === 'REVOKED'));
    writeFileSync(join(process.env.FUNCTIONAL_EVIDENCE_DIR!, 'binding-readback-postgres.json'), JSON.stringify({ at: new Date().toISOString(), verdict: 'PASS', scope: 'REAL_REHEARSAL_POSTGRES_TEMPORARY_BINDING_FIXTURE', newerRebindingNotHidden: true, newerRevocationNotHidden: true, querySha256: createHash('sha256').update(sql).digest('hex'), productionWrites: false }, null, 2), { flag: 'wx' });
    console.log('Binding readback regression PASS');
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
