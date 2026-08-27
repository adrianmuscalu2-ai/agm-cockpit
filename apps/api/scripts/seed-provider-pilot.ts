import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma=new PrismaClient();
async function main(){
  const user=await prisma.user.findFirst({where:{email:{equals:'agm.transporte.logistik@gmail.com',mode:'insensitive'},status:'Active'}});
  if(!user)throw new Error('PILOT_OWNER_ACCOUNT_NOT_FOUND');
  const start=new Date(),end=new Date('2026-08-27T22:00:00.000Z');
  const definitions=[
    {providerId:'tomtom',configured:Boolean(process.env.TOMTOM_API_KEY),credentialReference:'guardian:dpapi:live-provider-pilot:tomtom',dailyRequestLimit:60},
    {providerId:'here',configured:Boolean(process.env.HERE_API_KEY),credentialReference:'guardian:dpapi:live-provider-pilot:here',dailyRequestLimit:40},
    {providerId:'tollguru',configured:Boolean(process.env.TOLLGURU_API_KEY),credentialReference:'guardian:dpapi:live-provider-pilot:tollguru',dailyRequestLimit:12},
    {providerId:'gmail',configured:Boolean(process.env.GMAIL_FROM_ADDRESS&&(process.env.GMAIL_ACCESS_TOKEN||(process.env.GMAIL_OAUTH_CLIENT_ID&&process.env.GMAIL_OAUTH_CLIENT_SECRET&&process.env.GMAIL_OAUTH_REFRESH_TOKEN))),credentialReference:'guardian:dpapi:gmail-oauth-token',dailyRequestLimit:250},
  ];
  const result=[];
  for(const definition of definitions){const current=await prisma.providerPilotActivation.findUnique({where:{companyId_providerId:{companyId:user.companyId,providerId:definition.providerId}}});const state=current?.state==='SUSPENDED'?'SUSPENDED':definition.configured?'ACTIVE':'READY';const costValue=process.env[`${definition.providerId.toUpperCase()}_ESTIMATED_UNIT_COST_MICROS`];const estimatedUnitCostMicros=costValue&&Number.isInteger(Number(costValue))?Number(costValue):definition.providerId==='gmail'?0:null;const costBasis=definition.providerId==='gmail'&&estimatedUnitCostMicros===0?'OFFICIAL_STANDARD_USAGE_NO_ADDITIONAL_COST':estimatedUnitCostMicros===null?'REQUEST_COUNT_ONLY_PENDING_PROVIDER_BILLING':'CONFIGURED_UNIT_ESTIMATE';const activation=await prisma.providerPilotActivation.upsert({where:{companyId_providerId:{companyId:user.companyId,providerId:definition.providerId}},create:{companyId:user.companyId,providerId:definition.providerId,state,credentialReference:definition.configured?definition.credentialReference:null,allowedUserId:user.id,pilotStartAt:start,pilotEndAt:end,dailyRequestLimit:definition.dailyRequestLimit,anomalyAlertPercent:80,dailyCostAlertMicros:5_000_000,estimatedUnitCostMicros,costBasis,updatedByUserId:user.id},update:{state,credentialReference:definition.configured?definition.credentialReference:null,allowedUserId:user.id,pilotStartAt:start,pilotEndAt:end,dailyRequestLimit:definition.dailyRequestLimit,anomalyAlertPercent:80,dailyCostAlertMicros:5_000_000,estimatedUnitCostMicros,costBasis,updatedByUserId:user.id}});result.push({providerId:activation.providerId,state:activation.state,credentialReferencePresent:Boolean(activation.credentialReference),allowedUserScoped:activation.allowedUserId===user.id,dailyRequestLimit:activation.dailyRequestLimit,pilotEndAt:activation.pilotEndAt,costBasis:activation.costBasis});}
  console.log(JSON.stringify({verdict:'PILOT_PROVISIONING_RECORDED',ownerEmail:user.email,companyId:user.companyId,secretValuesPrinted:false,providers:result},null,2));
}
void main().finally(()=>prisma.$disconnect());
