import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const ROLLBACK = 'AGM_CAR_MOVER_ROLLBACK_TEST_COMPLETE';

async function main() {
  const sql = readFileSync(resolve(process.cwd(), '../../prisma/migrations/20260812090000_add_car_mover_p0_01/rollback.sql'), 'utf8');
  const statements = sql.split(';').map(value => value.trim()).filter(Boolean);
  try {
    await prisma.$transaction(async tx => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const rows = await tx.$queryRaw<Array<{ vehicle_table: string | null; job_table: string | null; scoped_columns: bigint }>>`
        SELECT to_regclass('public."CarMoverVehicleSubject"')::text AS vehicle_table,
               to_regclass('public."CarMoverJob"')::text AS job_table,
               (SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema='public'
                  AND table_name IN ('AuditEvent','OperationalEventStream','OperationalEvent')
                  AND column_name IN ('productId','moduleId','subjectType','subjectId')) AS scoped_columns
      `;
      if (rows[0]?.vehicle_table !== null || rows[0]?.job_table !== null || Number(rows[0]?.scoped_columns) !== 0) throw new Error('Rollback contract did not remove all P0-01 objects.');
      throw new Error(ROLLBACK);
    }, { timeout: 30_000 });
  } catch (error) {
    if (error instanceof Error && error.message === ROLLBACK) {
      console.log('Car Mover P0-01 rollback contract: PASS (rollback test itself reverted; local migration remains applied)');
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
