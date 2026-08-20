import { externalCapabilityRegistry, type ExternalAccess, type ExternalCapabilityId } from './external-capability.registry';

export type ExternalPermissionRequest = { requestId:string; capabilityId:string; provider:string; domain:string; action:string; access:ExternalAccess; scope:string; entitlement:string; actorId:string; tenantId:string; expectedTenantId:string; confirmation?:{explicit:true;requestId:string;capabilityId:string}; requestedAt:string };
export type ExternalAuditReceipt = { receiptId:string; requestId:string; actorId:string; tenantId:string; capabilityId:string; provider:string; access:ExternalAccess; confirmation:'NOT_REQUIRED'|'CONFIRMED'|'MISSING_OR_INVALID'; result:'ALLOWED'|'DENIED'|'SUCCESS'|'FAILURE'|'TIMEOUT'; reason:string; occurredAt:string; attempts:number };
export type ExternalPolicyDecision = { status:'ALLOWED'|'DENIED'; reason:string; receipt:ExternalAuditReceipt };

const SECRET_PATTERN=/(bearer\s+[\w.-]+|(^|[_-])token($|[_-])|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|password|credential)/i;
export function sanitizeExternalValue(value:unknown):unknown {
  if(typeof value==='string') return SECRET_PATTERN.test(value)?'[REDACTED]':value;
  if(Array.isArray(value)) return value.map(sanitizeExternalValue);
  if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,SECRET_PATTERN.test(key)?'[REDACTED]':sanitizeExternalValue(item)]));
  return value;
}

export class ExternalCapabilityPermissionRegistry {
  private readonly revoked=new Set<ExternalCapabilityId>();
  revoke(id:ExternalCapabilityId){this.revoked.add(id);}
  restore(id:ExternalCapabilityId){this.revoked.delete(id);}
  isRevoked(id:ExternalCapabilityId){return this.revoked.has(id);}
  evaluate(request:ExternalPermissionRequest):ExternalPolicyDecision{
    const registered=externalCapabilityRegistry.get(request.capabilityId as ExternalCapabilityId);
    let reason='POLICY_ALLOWED';
    if(!registered)reason='CAPABILITY_NOT_REGISTERED';
    else if(registered.state!=='ENABLED'||this.isRevoked(registered.id))reason='PERMISSION_REVOKED_OR_DISABLED';
    else if(registered.provider!==request.provider||!registered.allowedDomains.includes(request.domain)||!registered.allowedActions.includes(request.action))reason='PROVIDER_DOMAIN_OR_ACTION_NOT_ALLOWLISTED';
    else if(registered.access!==request.access||!registered.scopes.includes(request.scope))reason='ACCESS_OR_SCOPE_NOT_ALLOWED';
    else if(registered.requiredEntitlement!==request.entitlement)reason='ENTITLEMENT_REQUIRED';
    else if(!request.tenantId||request.tenantId!==request.expectedTenantId)reason='TENANT_ISOLATION_VIOLATION';
    else if(registered.confirmationRequired&&(!request.confirmation?.explicit||request.confirmation.requestId!==request.requestId||request.confirmation.capabilityId!==request.capabilityId))reason='EXPLICIT_CONFIRMATION_REQUIRED';
    const allowed=reason==='POLICY_ALLOWED';
    return{status:allowed?'ALLOWED':'DENIED',reason,receipt:this.receipt(request,allowed?'ALLOWED':'DENIED',reason,0,registered?.confirmationRequired?allowed?'CONFIRMED':'MISSING_OR_INVALID':'NOT_REQUIRED')};
  }
  receipt(request:ExternalPermissionRequest,result:ExternalAuditReceipt['result'],reason:string,attempts:number,confirmation:ExternalAuditReceipt['confirmation']='NOT_REQUIRED'):ExternalAuditReceipt{return sanitizeExternalValue({receiptId:crypto.randomUUID(),requestId:request.requestId,actorId:request.actorId,tenantId:request.tenantId,capabilityId:request.capabilityId,provider:request.provider,access:request.access,confirmation,result,reason,occurredAt:new Date().toISOString(),attempts}) as ExternalAuditReceipt;}
}
