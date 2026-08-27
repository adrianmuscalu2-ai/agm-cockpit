import { PrismaClient } from '@prisma/client';

const prisma=new PrismaClient();
async function main(){
  const company=await prisma.company.findFirst({orderBy:{createdAt:'asc'}});if(!company)throw new Error('COMPANY_NOT_FOUND');
  const events=await prisma.providerUsageEvent.findMany({where:{companyId:company.id,eventType:'PROVIDER_REQUEST'},orderBy:{occurredAt:'asc'}});
  const seen=new Set<string>();let corrected=0,recalculations=0;
  for(const event of events){
    const key=`${event.providerId}:${event.category}:${event.inputHash??event.id}`,isRouteRepeat=event.category==='ROUTE'&&seen.has(key);
    if(event.category==='ROUTE')seen.add(key);
    if(event.recalculation!==isRouteRepeat){await prisma.providerUsageEvent.update({where:{id:event.id},data:{recalculation:isRouteRepeat}});corrected++;}
    if(isRouteRepeat)recalculations++;
  }
  console.log(JSON.stringify({verdict:'RECALCULATION_TELEMETRY_NORMALIZED',rule:'REPEATED_ROUTE_INPUT_HASH_ONLY',eventsReviewed:events.length,eventsCorrected:corrected,recalculations,secretDisplayed:false},null,2));
}
void main().catch((error)=>{console.error(error instanceof Error?error.message:'NORMALIZATION_FAILED');process.exitCode=1;}).finally(()=>prisma.$disconnect());
