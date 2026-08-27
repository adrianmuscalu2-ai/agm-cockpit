import { PrismaClient } from '@prisma/client';

const prisma=new PrismaClient();
const subject=process.argv[2];if(!subject||!/^[0-9a-f-]{36}$/i.test(subject))throw new Error('SUBJECT_UUID_REQUIRED');
const quote=(value:string)=>`"${value.replaceAll('"','""')}"`;

async function main(){
  await prisma.$executeRawUnsafe('DELETE FROM "SubjectDataIndex" WHERE "subjectId"=$1::uuid',subject);
  const columns=await prisma.$queryRawUnsafe<Array<{table_name:string;column_name:string;data_type:string}>>(`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND data_type IN ('uuid','text','character varying','json','jsonb') ORDER BY table_name,column_name`);
  let indexed=0;
  for(const column of columns){
    if(['SubjectDataIndex','_prisma_migrations'].includes(column.table_name))continue;
    const table=quote(column.table_name),field=quote(column.column_name);const idExpression=column.column_name==='id'?`${field}::text`:`COALESCE(id::text,ctid::text)`;
    const condition=column.data_type==='uuid'?`${field}=$1::uuid`:`${field}::text LIKE '%' || $1 || '%'`;
    let rows:Array<{record_id:string}>=[];
    try{rows=await prisma.$queryRawUnsafe(`SELECT ${idExpression} AS record_id FROM ${table} WHERE ${condition}`,subject);}catch{continue;}
    for(const row of rows){await prisma.$executeRawUnsafe('INSERT INTO "SubjectDataIndex" (id,"subjectId","sourceTable","sourceColumn","recordId","matchKind",locator) VALUES (gen_random_uuid(),$1::uuid,$2,$3,$4,$5,$6::jsonb) ON CONFLICT ("subjectId","sourceTable","sourceColumn","recordId","matchKind") DO UPDATE SET "discoveredAt"=CURRENT_TIMESTAMP',subject,column.table_name,column.column_name,row.record_id,column.data_type==='uuid'?'EXACT_UUID':'TEXT_OR_JSON',JSON.stringify({dataType:column.data_type}));indexed++;}
  }
  const coverage=await prisma.$queryRawUnsafe<Array<{sourceTable:string;sourceColumn:string;matchKind:string;records:bigint}>>('SELECT "sourceTable", "sourceColumn", "matchKind", count(*) AS records FROM "SubjectDataIndex" WHERE "subjectId"=$1::uuid GROUP BY 1,2,3 ORDER BY 1,2,3',subject);
  console.log(JSON.stringify({contract:'agm-subject-data-index.v1',subjectId:subject,indexed,coverage:coverage.map(row=>({...row,records:Number(row.records)}))}));
}
main().finally(()=>prisma.$disconnect());
