export type RetentionCategory='expiredAuthSessions'|'revokedAuthSessions'|'completedDsarRecords'|'generatedDsarExports'|'postgresBackups'|'suppressionLedgerEntries'|'identifierAuditLogs';
export type RetentionCategoryPolicy={enabled:boolean;latencyHours?:number;retentionDays?:number;calendarYearsAfterCompletion?:number;maxSuccessfulDailyGenerations?:number;backupHorizonDays?:number;verificationMarginDays?:number};
export type RetentionPolicy={schemaVersion:1;policyVersion:string;timezone:'UTC';productionActivationAuthorized:false;categories:Record<RetentionCategory,RetentionCategoryPolicy>;excluded:string[]};
export type RetentionDecision={category:RetentionCategory;enabled:boolean;reason:string;cutoff?:Date;exclusiveCutoff?:boolean;maxGenerations?:number;trigger?:string};
const HOUR=3_600_000,DAY=86_400_000;
export const retentionCategories:RetentionCategory[]=['expiredAuthSessions','revokedAuthSessions','completedDsarRecords','generatedDsarExports','postgresBackups','suppressionLedgerEntries','identifierAuditLogs'];

export function validateRetentionPolicy(policy:RetentionPolicy){
  if(policy.schemaVersion!==1||policy.timezone!=='UTC'||policy.productionActivationAuthorized!==false)throw new Error('RETENTION_POLICY_CONTRACT_INVALID');
  for(const category of retentionCategories)if(!policy.categories[category]?.enabled)throw new Error(`RETENTION_CATEGORY_NOT_APPROVED:${category}`);
  exact(policy.categories.expiredAuthSessions.latencyHours,24,'EXPIRED_AUTH_LATENCY');exact(policy.categories.revokedAuthSessions.retentionDays,30,'REVOKED_AUTH_DAYS');exact(policy.categories.completedDsarRecords.calendarYearsAfterCompletion,3,'DSAR_CALENDAR_YEARS');exact(policy.categories.generatedDsarExports.retentionDays,7,'DSAR_EXPORT_DAYS');exact(policy.categories.postgresBackups.maxSuccessfulDailyGenerations,7,'BACKUP_GENERATIONS');exact(policy.categories.suppressionLedgerEntries.backupHorizonDays,7,'LEDGER_BACKUP_HORIZON');exact(policy.categories.suppressionLedgerEntries.verificationMarginDays,30,'LEDGER_MARGIN');exact(policy.categories.identifierAuditLogs.retentionDays,90,'AUDIT_LOG_DAYS');return policy;
}
function exact(actual:unknown,expected:number,label:string){if(actual!==expected)throw new Error(`RETENTION_APPROVAL_MISMATCH:${label}`);}

export function retentionPlan(policy:RetentionPolicy,env:Record<string,string|undefined>,now=new Date()):RetentionDecision[]{
  validateRetentionPolicy(policy);if(env.RETENTION_ENGINE_ENABLED!=='true')return retentionCategories.map(category=>({category,enabled:false,reason:'ENGINE_DISABLED_FAIL_CLOSED'}));
  const dsarYearCutoff=new Date(Date.UTC(now.getUTCFullYear()-3,0,1));
  return [
    {category:'expiredAuthSessions',enabled:true,reason:'OWNER_APPROVED_24H_MAX_LATENCY',cutoff:new Date(now.getTime()-24*HOUR)},
    {category:'revokedAuthSessions',enabled:true,reason:'OWNER_APPROVED_30_DAYS',cutoff:new Date(now.getTime()-30*DAY)},
    {category:'completedDsarRecords',enabled:true,reason:'OWNER_PROVISIONAL_THIRD_CALENDAR_YEAR_END',cutoff:dsarYearCutoff,exclusiveCutoff:true},
    {category:'generatedDsarExports',enabled:true,reason:'OWNER_APPROVED_7_DAYS',cutoff:new Date(now.getTime()-7*DAY),trigger:'EARLIER_OF_CONFIRMED_DELIVERY_OR_FIRST_TOKEN_EXPIRY'},
    {category:'postgresBackups',enabled:true,reason:'OWNER_APPROVED_MAX_7_SUCCESSFUL_DAILY_GENERATIONS',maxGenerations:7},
    {category:'suppressionLedgerEntries',enabled:true,reason:'OWNER_APPROVED_BACKUP_HORIZON_PLUS_30_DAYS',cutoff:new Date(now.getTime()-(7+30)*DAY)},
    {category:'identifierAuditLogs',enabled:true,reason:'OWNER_APPROVED_90_DAYS_WITH_HOLD',cutoff:new Date(now.getTime()-90*DAY)},
  ];
}

export function executionAuthorized(policy:RetentionPolicy,env:Record<string,string|undefined>){return policy.productionActivationAuthorized===false&&env.RETENTION_ENGINE_ENABLED==='true'&&env.RETENTION_EXECUTE==='true'&&env.RETENTION_NON_PRODUCTION_CONFIRMATION==='true';}
