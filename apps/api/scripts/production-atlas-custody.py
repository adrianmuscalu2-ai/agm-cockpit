"""Existing release OIDC -> official AGM API -> existing root-only secret store.

Run on the Production host as root. The API client secret never leaves that
host. No SQL writes, account selection, role changes, or automatic rotation.
Default mode is strictly inspect-only. --provision requires OIDC on stdin.
"""
import json
import fcntl
import os
import re
import stat
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = 'https://api.agmcockpit.com/api/v1'
COMPANY = '00000000-0000-0000-0000-000000000001'
STORE = Path('/opt/agm/production/secrets/agm-production.env')
SCOPES = ['acp:read', 'governance:propose']
PREFIX = 'ATLAS_OPERATIONS_'
FIELDS = {'CLIENT_ID', 'CLIENT_SECRET', 'CREDENTIAL_ID', 'EXPIRES_AT'}
DIAGNOSTIC = {}


class Failure(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def require(condition, code):
    if not condition:
        raise Failure(code)


def http_boundary(status, headers):
    content = headers.get('Content-Type', '').lower()
    return {'httpStatus': status, 'contentCategory': 'JSON' if 'application/json' in content else 'HTML' if 'text/html' in content else 'OTHER',
            'cloudflareServer': headers.get('Server', '').lower().startswith('cloudflare'),
            'explicitChallenge': headers.get('cf-mitigated', '').lower() == 'challenge'}


def inspect_http_boundary():
    # No credentials or valid provisioning body: auth guard rejects before writes.
    checks = []
    for method, path in [('GET', '/auth/me'), ('POST', '/auth/deploy/machines')]:
        request = urllib.request.Request(API + path, data=b'{}' if method == 'POST' else None,
                                         headers={'Content-Type': 'application/json'}, method=method)
        try:
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=15) as response:
                result = http_boundary(response.status, response.headers)
        except urllib.error.HTTPError as error:
            result = http_boundary(error.code, error.headers)
            error.close()
        checks.append(dict(result, client='PYTHON_STDLIB', method=method, credentialsSent=False))
    # Compare the established AGM curl transport, without changing user-agent,
    # following redirects, sending credentials or retrieving privileged data.
    result = subprocess.run(['curl', '--disable', '--silent', '--show-error', '--max-time', '15',
                             '--request', 'POST', '--header', 'Content-Type: application/json',
                             '--data', '{}', '--output', '/dev/null', '--write-out', '%{http_code}',
                             API + '/auth/deploy/machines'], capture_output=True, text=True, timeout=20, check=False)
    checks.append({'client': 'EXISTING_CURL', 'method': 'POST', 'credentialsSent': False,
                   'httpStatus': int(result.stdout) if result.returncode == 0 and result.stdout.isdigit() else None,
                   'transportExitCode': result.returncode})
    try:
        api('/auth/me')
        configured = {'httpStatus': 200}
    except Failure as error:
        value = str(error)
        code = value[len('ATLAS_API_HTTP_'):] if value.startswith('ATLAS_API_HTTP_') else value
        configured = {'httpStatus': int(code)} if code.isdigit() else {'httpStatus': None, 'transportFailureCode': str(error)}
    checks.append(dict(configured, client='EXISTING_CURL_STDIN_CONFIG', method='GET', credentialsSent=False))
    return checks


def read_store(store=STORE):
    info = store.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o600,
            'EXISTING_GUARDIAN_STORE_BOUNDARY_INVALID')
    parent = store.parent.stat()
    require(parent.st_uid == 0 and not parent.st_mode & 0o022, 'GUARDIAN_DIRECTORY_BOUNDARY_INVALID')
    content = store.read_bytes()
    bindings = {}
    for line in content.decode('utf-8').splitlines():
        if not line.startswith(PREFIX):
            continue
        key, separator, value = line.partition('=')
        require(separator and key not in bindings, 'ATLAS_CUSTODY_BINDING_INVALID')
        bindings[key] = value
    return content, bindings


def validate_response(data):
    require(data.get('subject') == 'atlas-operations' and data.get('companyId') == COMPANY,
            'ATLAS_CANONICAL_IDENTITY_MISMATCH')
    require(sorted(data.get('scopes', [])) == SCOPES, 'ATLAS_SCOPE_MISMATCH')
    uuid = r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}'
    require(re.fullmatch(uuid, data.get('clientId', '')) is not None, 'ATLAS_CLIENT_ID_INVALID')
    credential = data.get('credentialId', '')
    require(re.fullmatch(uuid, credential) is not None, 'ATLAS_CREDENTIAL_ID_INVALID')
    require(re.fullmatch(re.escape(credential) + r'\.[A-Za-z0-9_-]{64}', data.get('clientSecret', '')) is not None,
            'ATLAS_CREDENTIAL_FORMAT_INVALID')
    require(re.fullmatch(r'[0-9TZ:.+\-]+', data.get('expiresAt', '')) is not None, 'ATLAS_EXPIRY_INVALID')


def append_custody(data, previous, store=STORE):
    validate_response(data)
    current, bindings = read_store(store)
    require(current == previous and not bindings, 'GUARDIAN_STORE_CHANGED_OR_ATLAS_BINDING_EXISTS')
    values = {'CLIENT_ID': data['clientId'], 'CLIENT_SECRET': data['clientSecret'],
              'CREDENTIAL_ID': data['credentialId'], 'EXPIRES_AT': data['expiresAt']}
    addition = ''.join(f'{PREFIX}{key}={values[key]}\n' for key in sorted(FIELDS)).encode('ascii')
    descriptor = os.open(store, os.O_RDWR | os.O_APPEND | os.O_NOFOLLOW)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        opened = os.fstat(descriptor)
        current_path = store.lstat()
        require((opened.st_dev, opened.st_ino) == (current_path.st_dev, current_path.st_ino), 'GUARDIAN_STORE_REPLACED')
        require(stat.S_ISREG(opened.st_mode) and opened.st_uid == 0 and stat.S_IMODE(opened.st_mode) == 0o600,
                'EXISTING_GUARDIAN_STORE_BOUNDARY_INVALID')
        require(os.read(descriptor, opened.st_size + 1) == previous, 'GUARDIAN_STORE_CHANGED')
        # One append-only write: never rewrite/truncate/copy other secret values.
        addition = (b'' if previous.endswith(b'\n') else b'\n') + addition
        require(os.write(descriptor, addition) == len(addition), 'GUARDIAN_APPEND_INCOMPLETE')
        os.fsync(descriptor)
        current_path = store.lstat()
        require((opened.st_dev, opened.st_ino) == (current_path.st_dev, current_path.st_ino), 'GUARDIAN_STORE_REPLACED')
        _, confirmed = read_store(store)
        require(confirmed == {PREFIX + key: values[key] for key in FIELDS}, 'GUARDIAN_APPEND_NOT_PROVEN')
    finally:
        os.close(descriptor)


def api(path, body=None, bearer=None, expected=200):
    DIAGNOSTIC['operation'] = ('HUMAN_SESSION_NEGATIVE_CHECK' if path == '/auth/me' else
                               'MACHINE_TOKEN_ISSUE' if path == '/auth/m2m/token' else
                               'GOVERNANCE_HTTP_BOUNDARY' if path.startswith('/governance-v2/') else
                               'AUTHORIZED_REGISTRY_READ' if path.startswith('/m2m/') else
                               'CREDENTIAL_REVOCATION' if path.endswith('/revoke') else 'MACHINE_PROVISION')
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json', 'Cache-Control': 'no-store'}
    if bearer:
        headers['Authorization'] = f'Bearer {bearer}'
    # Reuse AGM's established curl transport. No UA spoofing, redirects,
    # challenge handling or policy changes. Credentials/config go on stdin,
    # never command arguments, temporary files, stdout logs or artifacts.
    config = ['silent', 'show-error', 'include', 'suppress-connect-headers', 'max-time = 20',
              'url = ' + json.dumps(API + path),
              'request = ' + json.dumps('GET' if body is None else 'POST'),
              'write-out = "\\nAGM_HTTP_STATUS:%{http_code}"']
    config += ['header = ' + json.dumps(key + ': ' + value) for key, value in headers.items()]
    if body is not None:
        config.append('data-binary = ' + json.dumps(json.dumps(body)))
    result = subprocess.run(['curl', '--disable', '--config', '-'], input='\n'.join(config) + '\n',
                            capture_output=True, text=True, timeout=25, check=False)
    require(result.returncode == 0, 'ATLAS_CURL_TRANSPORT_FAILED')
    envelope, marker, status = result.stdout.rpartition('\nAGM_HTTP_STATUS:')
    require(bool(marker) and status.isdigit() and 100 <= int(status) <= 599, 'ATLAS_HTTP_STATUS_NOT_PROVEN')
    header_block, separator, response_body = envelope.partition('\n\n')
    require(bool(separator), 'ATLAS_HTTP_ENVELOPE_INVALID')
    response_headers = {}
    for line in header_block.splitlines()[1:]:
        name, colon, value = line.partition(':')
        if colon:
            response_headers[name.strip().lower()] = value.strip()
    boundary = http_boundary(int(status), {
        'Content-Type': response_headers.get('content-type', ''),
        'Server': response_headers.get('server', ''),
        'cf-mitigated': response_headers.get('cf-mitigated', ''),
    })
    if int(status) != expected:
        DIAGNOSTIC.update(boundary)
        raise Failure(f'ATLAS_API_HTTP_{status}')
    return json.loads(response_body)


def registry():
    # No hashes, e-mail addresses, tokens or passwords selected. No SQL writes.
    script = r'''
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{try{
const companyId='00000000-0000-0000-0000-000000000001';
const identities=await p.machineIdentity.findMany({where:{companyId,subject:'atlas-operations'},select:{id:true,companyId:true,subject:true,status:true,scopes:true}});
const audits=await p.auditEvent.findMany({where:{companyId,actionCode:'AUTH_PASSWORD_RECOVERED',occurredAt:{gte:new Date(Math.max(Date.parse('2026-11-08T20:24:00Z'),Date.now()-86400000))}},select:{actorUserId:true,entityId:true,requestId:true,metadata:true,occurredAt:true}});
const recoveredUsers=[...new Set(audits.map(a=>a.actorUserId).filter(Boolean))];
let activeOwnersWithPostRecoverySession=0;
const verifiedRecoveryCandidates=[];
for(const id of recoveredUsers){
const user=await p.user.findFirst({where:{id,companyId,status:'Active',company:{isActive:true},roles:{some:{companyId,role:{code:'company_owner',companyId,isActive:true}}}},select:{id:true,credentialVersion:true}});
if(!user)continue;
const audit=audits.filter(a=>a.actorUserId===id).sort((a,b)=>b.occurredAt-a.occurredAt)[0];
if(audit.entityId!==id||audit.metadata?.ownershipProof!=='SINGLE_USE_EMAIL_LINK'||audit.metadata?.sessionsRevoked!==true||audit.metadata?.credentialVersion!==user.credentialVersion)continue;
const recoveredAt=audit.occurredAt;
const session=await p.authSession.findFirst({where:{userId:id,companyId,createdAt:{gte:recoveredAt},revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true}});
if(session){activeOwnersWithPostRecoverySession++;verifiedRecoveryCandidates.push({recoveryRequestId:audit.requestId,recoveredAt,authenticatedCompanyOwner:true});}
}
process.stdout.write(JSON.stringify({identities,postRecovery:{recoveredAccountCount:recoveredUsers.length,activeOwnersWithPostRecoverySession,verifiedRecoveryCandidates,commanderBindingAuthorized:false}}));
}finally{await p.$disconnect()}})().catch(()=>{process.stderr.write('REGISTRY_READ_FAILED');process.exitCode=1});
'''
    result = subprocess.run(['docker', 'exec', '-i', '-w', '/app', 'agm-production-api', 'node', '-'],
                            input=script, text=True, capture_output=True, timeout=30, check=False)
    require(result.returncode == 0, 'REGISTRY_READ_FAILED')
    return json.loads(result.stdout)


def governance_readiness():
    # Diagnostic-only: invoke the actually deployed read implementations inside
    # an enforced read-only transaction. Never create a proposal/assessment,
    # simulate a human JWT, assign a role, or infer formal activation.
    script = r'''
const {PrismaClient}=require('@prisma/client');
const {GovernanceV2Persistence}=require('./apps/api/src/governance-v2/governance-v2.persistence');
const {GovernanceV2RuntimeService}=require('./apps/api/src/governance-v2/governance-v2.runtime');
const {createHash}=require('node:crypto'); const {readFileSync}=require('node:fs');
const p=new PrismaClient();
(async()=>{try{
const report=await p.$transaction(async tx=>{
await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
const runtime=new GovernanceV2RuntimeService(new GovernanceV2Persistence(tx));
const actors=await runtime.listGovernanceActors();
const proposals=await runtime.listProposals();
const knowledge=await runtime.searchRiskKnowledge('AGM');
const assessments=await runtime.searchRiskKnowledgeAssessments('AGM');
const events=await runtime.listGovernanceEvents();
const bindings=await tx.$queryRawUnsafe('SELECT actor_id,principal_type,status FROM agm_governance.actor_identity_bindings ORDER BY actor_id,principal_type');
const triggers=await tx.$queryRawUnsafe("SELECT count(*)::int AS total,count(*) FILTER (WHERE t.tgenabled='D')::int AS disabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='agm_governance' AND NOT t.tgisinternal");
const active=actors.filter(a=>a.status==='ACTIVE');
const roleCoverage={}; for(const role of ['PROPOSER','APPROVER','EXECUTOR','VALIDATOR']) roleCoverage[role]=active.filter(a=>Array.isArray(a.roles)&&a.roles.includes(role)).map(a=>a.actor_id);
const sourceDigests={}; for(const name of ['risk-knowledge-orchestrator.ts','governance-v2.contract.ts','governance-v2.persistence.ts','governance-v2.runtime.ts']) sourceDigests[name]=createHash('sha256').update(readFileSync('./apps/api/src/governance-v2/'+name)).digest('hex');
return {scope:'ACTUAL_PRODUCTION_MODULE_READS_IN_READ_ONLY_TRANSACTION',deployedRevision:process.env.AGM_BUILD_SHA,proposalRead:'PASS',proposalCount:proposals.length,riskKnowledgeRead:'PASS',riskKnowledgeEvidenceCount:knowledge.total,riskAssessmentRead:'PASS',matchingAssessmentCount:assessments.length,governanceEventRead:'PASS',governanceEventCount:events.length,roleCoverage,bindings,triggerControls:triggers[0],sourceDigests,authenticatedHttpRead:'NOT_TESTED_NO_USER_TOKEN_EXPORT',formalActivation:'NOT_CLAIMED',rolesChanged:false,sqlDataWrites:false};
},{timeout:20000});
process.stdout.write(JSON.stringify(report));
}finally{await p.$disconnect()}})().catch(()=>{process.stderr.write('GOVERNANCE_READ_ONLY_PROBE_FAILED');process.exitCode=1});
'''
    result = subprocess.run(['docker', 'exec', '-i', '-w', '/app', 'agm-production-api',
                             'apps/api/node_modules/.bin/ts-node', '--project', 'apps/api/tsconfig.json',
                             '--transpile-only', '-e', script], capture_output=True, text=True, timeout=60, check=False)
    require(result.returncode == 0, 'GOVERNANCE_READ_ONLY_PROBE_FAILED')
    return json.loads(result.stdout)


def verify_governance_boundary(bearer):
    # Only the existing Atlas token/scopes. An empty proposal has no mandatory
    # ID/title/candidate, so it cannot persist even if validation regresses.
    rejected = api('/governance-v2/proposals', {}, bearer, 400)
    require('PROPOSAL_CONTRACT_INCOMPLETE' in json.dumps(rejected), 'ATLAS_GOVERNANCE_BINDING_NOT_PROVEN')
    try:
        api('/governance-v2/proposals', bearer=bearer)
    except Failure as error:
        require(str(error) == 'ATLAS_API_HTTP_401', 'ATLAS_GOVERNANCE_HUMAN_BOUNDARY_NOT_PROVEN')
    else:
        raise Failure('ATLAS_GOVERNANCE_HUMAN_BOUNDARY_NOT_PROVEN')
    return {'machineAuthenticationAndProposerBinding': 'PASS', 'incompleteProposalRejected': True,
            'humanReadRejected': True, 'proposalCreated': False, 'formalActivation': 'NOT_CLAIMED'}


def run(provision=False, inspect_http=False, verify_governance=False):
    DIAGNOSTIC.clear()
    require(os.geteuid() == 0, 'EXISTING_ROOT_CUSTODY_AUTHORITY_REQUIRED')
    original, bindings = read_store()
    observed = registry()
    identities = observed['identities']
    require(len(identities) <= 1, 'ATLAS_IDENTITY_NOT_UNIQUE')
    report = {'subject': 'atlas-operations', 'registryCount': len(identities),
              'postRecovery': observed['postRecovery'], 'secretsDisplayed': False,
              'guardianImplementationChanged': False, 'rkChanged': False}
    DIAGNOSTIC.update(report)
    DIAGNOSTIC['custodyBindingPresent'] = bool(bindings)
    if not provision:
        return dict(report, mode='READ_ONLY', custodyBindingPresent=bool(bindings),
                    **({'httpBoundary': inspect_http_boundary(), 'governanceReadiness': governance_readiness()} if inspect_http else {}))
    oidc = sys.stdin.read(16385).strip()
    require(len(oidc) <= 16384 and re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', oidc),
            'OFFICIAL_RELEASE_OIDC_REQUIRED')
    created = False
    if not identities:
        require(not bindings, 'ATLAS_ORPHAN_CUSTODY_REQUIRES_REVIEW')
        data = api('/auth/deploy/machines', {'subject': 'atlas-operations', 'expiresInDays': 365}, oidc, 201)['data']
        validate_response(data)
        try:
            append_custody(data, original)
        except Exception:
            # Revoke only this newly issued credential if custody cannot be secured.
            api(f"/auth/deploy/machines/{data['clientId']}/credentials/{data['credentialId']}/revoke",
                {'reason': 'GUARDIAN_CUSTODY_WRITE_FAILED'}, oidc, 201)
            raise Failure('NEW_ATLAS_CREDENTIAL_REVOKED_AFTER_CUSTODY_FAILURE') from None
        created = True
        _, bindings = read_store()
    identity = registry()['identities']
    require(len(identity) == 1 and identity[0]['status'] == 'ACTIVE' and sorted(identity[0]['scopes']) == SCOPES,
            'ATLAS_ACTIVE_IDENTITY_NOT_PROVEN')
    require(set(bindings) == {PREFIX + key for key in FIELDS}, 'ATLAS_CUSTODY_INCOMPLETE_NO_AUTOMATIC_ROTATION')
    require(identity[0]['id'] == bindings[PREFIX + 'CLIENT_ID'], 'ATLAS_CUSTODY_IDENTITY_MISMATCH')
    issued = api('/auth/m2m/token', {'grant_type': 'client_credentials',
                 'client_id': bindings[PREFIX + 'CLIENT_ID'], 'client_secret': bindings[PREFIX + 'CLIENT_SECRET']}, expected=201)
    require(sorted(issued.get('scope', '').split()) == SCOPES, 'ATLAS_TOKEN_SCOPE_MISMATCH')
    network = api(f'/m2m/authority-control-plane/companies/{COMPANY}/network-registry', bearer=issued['access_token'])
    require(isinstance(network.get('data'), list), 'ATLAS_AUTHORIZED_READ_NOT_PROVEN')
    try:
        api('/auth/me', bearer=issued['access_token'])
    except Failure as error:
        require(str(error) == 'ATLAS_API_HTTP_401', 'ATLAS_HUMAN_SESSION_ISOLATION_NOT_PROVEN')
    else:
        raise Failure('ATLAS_HUMAN_SESSION_ISOLATION_NOT_PROVEN')
    return dict(report, mode='PROVISION_OR_REUSE', created=created, active=True,
                custody='EXISTING_ROOT_ONLY_PRODUCTION_ENV', authentication='PASS',
                clientId=bindings[PREFIX + 'CLIENT_ID'], credentialId=bindings[PREFIX + 'CREDENTIAL_ID'],
                expiresAt=bindings[PREFIX + 'EXPIRES_AT'], humanSessionRejected=True,
                authorizedScopes=SCOPES, administrativePrivileges=False, governanceBinding='NOT_CLAIMED',
                **({'governanceBoundary': verify_governance_boundary(issued['access_token'])} if verify_governance else {}))


if __name__ == '__main__':
    try:
        require(sys.argv[1:] in ([], ['--provision'], ['--inspect-http'], ['--provision', '--verify-governance']), 'INVALID_OPERATION')
        print(json.dumps(run('--provision' in sys.argv[1:], sys.argv[1:] == ['--inspect-http'], '--verify-governance' in sys.argv[1:])))
    except Exception as error:
        reason = str(error) if isinstance(error, Failure) else type(error).__name__
        print(json.dumps(dict(DIAGNOSTIC, atlas='FAIL', reason=reason, secretsDisplayed=False)))
        sys.exit(1)
