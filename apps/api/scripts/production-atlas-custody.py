"""Existing release OIDC -> official AGM API -> existing root-only secret store.

Run on the Production host as root. The API client secret never leaves that
host. No SQL writes, account selection, role changes, or automatic rotation.
Default mode is strictly inspect-only. --provision requires OIDC on stdin.
"""
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

API = 'https://api.agmcockpit.com/api/v1'
COMPANY = '00000000-0000-0000-0000-000000000001'
STORE = Path('/opt/agm/production/secrets/agm-production.env')
SCOPES = ['acp:read', 'governance:propose']
PREFIX = 'ATLAS_OPERATIONS_'
FIELDS = {'CLIENT_ID', 'CLIENT_SECRET', 'CREDENTIAL_ID', 'EXPIRES_AT'}


class Failure(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def require(condition, code):
    if not condition:
        raise Failure(code)


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
    candidate = None
    try:
        fd, candidate = tempfile.mkstemp(prefix='.atlas-custody-', dir=store.parent)
        with os.fdopen(fd, 'wb') as target:
            os.fchmod(target.fileno(), 0o600)
            target.write(previous + (b'' if previous.endswith(b'\n') else b'\n') + addition)
            target.flush()
            os.fsync(target.fileno())
        # Do not overwrite a concurrent Guardian/configuration update.
        require(read_store(store)[0] == previous, 'GUARDIAN_STORE_CHANGED')
        os.replace(candidate, store)
        candidate = None
        directory = os.open(store.parent, os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        read_store(store)
    finally:
        if candidate is not None:
            os.unlink(candidate)


def api(path, body=None, bearer=None, expected=200):
    headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}
    if bearer:
        headers['Authorization'] = f'Bearer {bearer}'
    payload = None if body is None else json.dumps(body).encode('utf-8')
    request = urllib.request.Request(API + path, data=payload, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
            require(response.status == expected, 'ATLAS_API_UNEXPECTED_STATUS')
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise Failure(f'ATLAS_API_HTTP_{error.code}') from None


def registry():
    # No hashes, e-mail addresses, tokens or passwords selected. No SQL writes.
    script = r'''
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{try{
const companyId='00000000-0000-0000-0000-000000000001';
const identities=await p.machineIdentity.findMany({where:{companyId,subject:'atlas-operations'},select:{id:true,companyId:true,subject:true,status:true,scopes:true}});
const audits=await p.auditEvent.findMany({where:{companyId,actionCode:'AUTH_PASSWORD_RECOVERED',occurredAt:{gte:new Date('2026-11-08T20:24:00Z')}},select:{actorUserId:true,occurredAt:true}});
const recoveredUsers=[...new Set(audits.map(a=>a.actorUserId).filter(Boolean))];
let activeOwnersWithPostRecoverySession=0;
for(const id of recoveredUsers){
const user=await p.user.findFirst({where:{id,companyId,status:'Active',company:{isActive:true},roles:{some:{companyId,role:{code:'company_owner',companyId,isActive:true}}}},select:{id:true}});
if(!user)continue;
const recoveredAt=audits.filter(a=>a.actorUserId===id).sort((a,b)=>b.occurredAt-a.occurredAt)[0].occurredAt;
const session=await p.authSession.findFirst({where:{userId:id,companyId,createdAt:{gte:recoveredAt},revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true}});
if(session)activeOwnersWithPostRecoverySession++;
}
process.stdout.write(JSON.stringify({identities,postRecovery:{recoveredAccountCount:recoveredUsers.length,activeOwnersWithPostRecoverySession,commanderBindingAuthorized:false}}));
}finally{await p.$disconnect()}})().catch(()=>{process.stderr.write('REGISTRY_READ_FAILED');process.exitCode=1});
'''
    result = subprocess.run(['docker', 'exec', '-i', '-w', '/app', 'agm-production-api', 'node', '-'],
                            input=script, text=True, capture_output=True, timeout=30, check=False)
    require(result.returncode == 0, 'REGISTRY_READ_FAILED')
    return json.loads(result.stdout)


def run(provision=False):
    require(os.geteuid() == 0, 'EXISTING_ROOT_CUSTODY_AUTHORITY_REQUIRED')
    original, bindings = read_store()
    observed = registry()
    identities = observed['identities']
    require(len(identities) <= 1, 'ATLAS_IDENTITY_NOT_UNIQUE')
    report = {'subject': 'atlas-operations', 'registryCount': len(identities),
              'postRecovery': observed['postRecovery'], 'secretsDisplayed': False,
              'guardianImplementationChanged': False, 'rkChanged': False}
    if not provision:
        return dict(report, mode='READ_ONLY', custodyBindingPresent=bool(bindings))
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
                 'client_id': bindings[PREFIX + 'CLIENT_ID'], 'client_secret': bindings[PREFIX + 'CLIENT_SECRET']})
    require(sorted(issued.get('scope', '').split()) == SCOPES, 'ATLAS_TOKEN_SCOPE_MISMATCH')
    network = api(f'/m2m/authority-control-plane/companies/{COMPANY}/network-registry', bearer=issued['access_token'])
    require(isinstance(network.get('data'), list), 'ATLAS_AUTHORIZED_READ_NOT_PROVEN')
    return dict(report, mode='PROVISION_OR_REUSE', created=created, active=True,
                custody='EXISTING_ROOT_ONLY_PRODUCTION_ENV', authentication='PASS',
                authorizedScopes=SCOPES, administrativePrivileges=False, governanceBinding='NOT_CLAIMED')


if __name__ == '__main__':
    try:
        require(sys.argv[1:] in ([], ['--provision']), 'INVALID_OPERATION')
        print(json.dumps(run(sys.argv[1:] == ['--provision'])))
    except Exception as error:
        reason = str(error) if isinstance(error, Failure) else type(error).__name__
        print(json.dumps({'atlas': 'FAIL', 'reason': reason, 'secretsDisplayed': False}))
        sys.exit(1)
