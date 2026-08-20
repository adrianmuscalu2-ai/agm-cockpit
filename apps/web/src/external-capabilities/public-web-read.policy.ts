import { sanitizeExternalValue, type ExternalAuditReceipt } from './external-capability.policy';

export type WebReadDecision = Readonly<{ status:'ALLOWED'|'DENIED'|'STOP_AUTH_REQUIRED'; reason:string; receipt:ExternalAuditReceipt }>;
const blockedExtensions=/\.(exe|msi|bat|cmd|ps1|scr|apk|dmg|pkg|deb|rpm)(?:$|[?#])/i;
const restrictedPath=/(^|\/)(login|signin|auth|account|admin|private|checkout|subscribe)(\/|$)/i;
const injection=/(ignore (all|previous) instructions|system prompt|developer message|reveal (a )?(secret|token|key)|run this command)/gi;

export class PublicWebReadPolicy {
 private revoked=false; revoke(){this.revoked=true;}
 evaluate(url:string,method='GET'):WebReadDecision{
  const requestId=crypto.randomUUID();let reason='PUBLIC_WEB_READ_ALLOWED',status:WebReadDecision['status']='ALLOWED';let parsed:URL|undefined;
  try{parsed=new URL(url);}catch{reason='INVALID_URL';status='DENIED';}
  if(this.revoked){reason='PERMISSION_REVOKED';status='DENIED';}
  else if(method!=='GET'&&method!=='HEAD'){reason='WRITE_METHOD_DENIED';status='DENIED';}
  else if(parsed&&!['http:','https:'].includes(parsed.protocol)){reason='NON_WEB_PROTOCOL_DENIED';status='DENIED';}
  else if(parsed&&(parsed.username||parsed.password)){reason='CREDENTIAL_IN_URL_DENIED';status='DENIED';}
  else if(parsed&&blockedExtensions.test(parsed.pathname)){reason='SUSPECT_EXECUTABLE_DOWNLOAD_DENIED';status='DENIED';}
  else if(parsed&&restrictedPath.test(parsed.pathname)){reason='AUTHENTICATED_OR_RESTRICTED_BOUNDARY';status='STOP_AUTH_REQUIRED';}
  return{status,reason,receipt:sanitizeExternalValue({receiptId:crypto.randomUUID(),requestId,actorId:'copilot:web',tenantId:'tenant:agm',capabilityId:'PUBLIC_WEB_READ',provider:'PUBLIC_WEB',access:'READ',confirmation:'NOT_REQUIRED',result:status==='ALLOWED'?'ALLOWED':'DENIED',reason,occurredAt:new Date().toISOString(),attempts:0}) as ExternalAuditReceipt};
 }
 evaluateRedirect(from:string,to:string){const decision=this.evaluate(to);if(decision.status!=='ALLOWED')return decision;const a=new URL(from),b=new URL(to);return{...decision,reason:a.origin===b.origin?'SAME_ORIGIN_REDIRECT_ALLOWED':'EXTERNAL_REDIRECT_REVALIDATED_ALLOWED'};}
 sanitizePageText(text:string){return sanitizeExternalValue(text.replace(injection,'[UNTRUSTED_PAGE_INSTRUCTION_BLOCKED]')) as string;}
}
