"""Bounded maintenance through existing release OIDC/API and Guardian store.

No provisioning or authority mutation. Execute as root; real OIDC arrives on stdin.
Default inspect-only; --renew is used only by the gated canonical release workflow.
"""
import argparse
import datetime as dt
import fcntl
import importlib.util
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location('atlas_custody', Path(__file__).with_name('production-atlas-custody.py'))
custody = importlib.util.module_from_spec(spec)
spec.loader.exec_module(custody)
require, api = custody.require, custody.api
STORE = custody.STORE
TARGETS = {
    'VALIDATOR': ('3bca0eb6-2051-4c35-89d4-cafe5082c3ab', 'premium.architecture-inspector'),
    'EXECUTOR': ('dca5cb02-72f0-4837-8ba8-31cbdb05ddee', 'premium.recovery-executor'),
}
WARNING_SECONDS = 12 * 3600


def timestamp(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


def checked_store(store):
    parent = store.parent.stat()
    require(parent.st_uid == 0 and not parent.st_mode & 0o022, 'GUARDIAN_DIRECTORY_BOUNDARY_INVALID')
    fd = os.open(store, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o600, 'GUARDIAN_STORE_BOUNDARY_INVALID')
        raw = os.read(fd, info.st_size + 1)
    finally:
        os.close(fd)
    values = {}
    for line in raw.decode().splitlines():
        if re.match(r'PR(?:29|33|36)_(VALIDATOR|EXECUTOR)_', line):
            key, sep, value = line.partition('=')
            require(sep and key not in values, 'DUPLICATE_CUSTODY_KEY')
            values[key] = value
    return raw, values


def locate(values, identity, credential):
    prefixes = [key[:-len('CREDENTIAL_ID')] for key, value in values.items() if key.endswith('CREDENTIAL_ID') and value == credential['id']]
    require(len(prefixes) == 1, 'CURRENT_CREDENTIAL_CUSTODY_NOT_PROVEN')
    prefix = prefixes[0]
    require(values.get(prefix + 'CLIENT_ID') == identity['id'] and values.get(prefix + 'CLIENT_SECRET'), 'CURRENT_CREDENTIAL_CUSTODY_NOT_PROVEN')
    require(timestamp(values[prefix + 'EXPIRES_AT']) == timestamp(credential['expiresAt']), 'CUSTODY_EXPIRY_MISMATCH')
    return values[prefix + 'CLIENT_SECRET']


def append_version(store, role, version, issued, previous):
    prefix = f'PR36_{role}_V{version}_'
    values = {'CLIENT_ID': issued['clientId'], 'CREDENTIAL_ID': issued['credentialId'], 'CLIENT_SECRET': issued['clientSecret'], 'EXPIRES_AT': issued['expiresAt']}
    require(re.fullmatch(re.escape(issued['credentialId']) + r'\.[A-Za-z0-9_-]{64}', issued['clientSecret']), 'INVALID_NEW_CREDENTIAL')
    require(all('\n' not in value and '\r' not in value for value in values.values()), 'INVALID_CUSTODY_VALUE')
    fd = os.open(store, os.O_RDWR | os.O_APPEND | os.O_NOFOLLOW)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        info, current = os.fstat(fd), store.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o600, 'GUARDIAN_STORE_BOUNDARY_INVALID')
        require((info.st_dev, info.st_ino) == (current.st_dev, current.st_ino), 'GUARDIAN_STORE_REPLACED')
        require(os.read(fd, info.st_size + 1) == previous and prefix.encode() not in previous, 'CUSTODY_CHANGED_OR_VERSION_EXISTS')
        addition = (b'' if previous.endswith(b'\n') else b'\n') + ''.join(prefix + k + '=' + v + '\n' for k, v in values.items()).encode()
        require(os.write(fd, addition) == len(addition), 'CUSTODY_APPEND_INCOMPLETE')
        os.fsync(fd)
        after, bindings = checked_store(store)
        require(after.startswith(previous) and all(bindings.get(prefix + k) == v for k, v in values.items()), 'CUSTODY_PUBLICATION_NOT_PROVEN')
        current = store.lstat()
        require((info.st_dev, info.st_ino) == (current.st_dev, current.st_ino), 'GUARDIAN_STORE_REPLACED')
    finally:
        os.close(fd)


def container_pin():
    r = subprocess.run(['docker', 'inspect', '--format', '{{.Id}}|{{.State.StartedAt}}|{{.State.Running}}|{{.State.Restarting}}', 'agm-production-api'], capture_output=True, text=True, timeout=15)
    fields = r.stdout.strip().split('|')
    require(r.returncode == 0 and len(fields) == 4 and fields[2:] == ['true', 'false'], 'STABLE_CONTAINER_REQUIRED')
    return fields


def metadata(pin):
    require(container_pin() == pin, 'CONTAINER_CHANGED')
    script = r'''
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const r=await p.$transaction(async t=>{await t.$executeRawUnsafe('SET TRANSACTION READ ONLY');
const companyId='00000000-0000-0000-0000-000000000001';
return {revision:process.env.AGM_BUILD_SHA,database:await t.$queryRawUnsafe('SELECT current_database() AS name,system_identifier::text AS system FROM pg_control_system()'),
identities:await t.machineIdentity.findMany({where:{companyId,subject:{in:['premium.architecture-inspector','premium.recovery-executor']}},select:{id:true,companyId:true,subject:true,status:true,scopes:true,credentials:{orderBy:{version:'desc'},take:1,select:{id:true,version:true,expiresAt:true,revokedAt:true,lastUsedAt:true}}}}),
mandates:await t.authorityMandate.findMany({where:{companyId,status:'APPROVED',revokedAt:null,agentId:{in:['premium.architecture-inspector','premium.recovery-executor']}},select:{agentId:true,mandateKey:true,mode:true,scopeId:true,expiresAt:true}}),
actors:await t.$queryRawUnsafe("SELECT actor_id AS id,status,roles,can_validate,can_execute FROM agm_governance.actor_principals WHERE actor_id IN ('premium.architecture-inspector','premium.recovery-executor')"),
bindings:await t.$queryRawUnsafe("SELECT DISTINCT ON (principal_id) actor_id,principal_id,status,company_id FROM agm_governance.actor_identity_bindings WHERE principal_type='MACHINE_IDENTITY' AND principal_id IN ('3bca0eb6-2051-4c35-89d4-cafe5082c3ab','dca5cb02-72f0-4837-8ba8-31cbdb05ddee') ORDER BY principal_id,binding_id DESC")};});console.log(JSON.stringify(r));})().catch(()=>{process.stderr.write('READ_ONLY_METADATA_FAILED');process.exitCode=1}).finally(()=>p.$disconnect());
'''
    r = subprocess.run(['docker', 'exec', '-i', pin[0], 'node'], input=script, capture_output=True, text=True, timeout=30)
    require(r.returncode == 0, 'READ_ONLY_METADATA_FAILED')
    return json.loads(r.stdout)


def eligible(data, role, revision, now):
    identity_id, subject = TARGETS[role]
    require(data['revision'] == revision and data['database'] == [{'name': 'agm', 'system': '7665798064781766689'}], 'EXACT_DEPLOYED_REVISION_DATABASE_REQUIRED')
    matches = [i for i in data['identities'] if i['id'] == identity_id and i['subject'] == subject]
    require(len(matches) == 1, 'EXACT_EXISTING_IDENTITY_REQUIRED')
    identity = matches[0]
    require(identity['companyId'] == custody.COMPANY and identity['status'] == 'ACTIVE' and identity['scopes'] == ['acp:read'], 'UNCHANGED_ACTIVE_IDENTITY_REQUIRED')
    mandate_key, mode, scope = ('inspector-failover:' + subject, 'INSPECTOR', 'premium.architecture') if role == 'VALIDATOR' else ('operational-duty:' + subject, 'OPERATIONAL_DUTY', 'premium.recovery')
    require(any(m['agentId'] == subject and m['mandateKey'] == mandate_key and m['mode'] == mode and m['scopeId'] == scope and (m['expiresAt'] is None or timestamp(m['expiresAt']) >= now + 86460) for m in data['mandates']), 'MANDATE_MUST_COVER_ONE_DAY_CREDENTIAL')
    require(any(a['id'] == subject and a['status'] == 'ACTIVE' and a['roles'] == [role] and a['can_validate' if role == 'VALIDATOR' else 'can_execute'] is True for a in data['actors']), 'FORMAL_ACTOR_ROLE_REQUIRED')
    require(any(b['actor_id'] == subject and b['principal_id'] == identity_id and b['status'] == 'BOUND' and b['company_id'] == custody.COMPANY for b in data['bindings']), 'UNCHANGED_ACTOR_BINDING_REQUIRED')
    require(len(identity['credentials']) == 1 and not identity['credentials'][0]['revokedAt'], 'CURRENT_UNREVOKED_CREDENTIAL_REQUIRED')
    return identity, identity['credentials'][0]


def authenticate(identity, secret):
    issued = api('/auth/m2m/token', {'grant_type': 'client_credentials', 'client_id': identity['id'], 'client_secret': secret}, expected=201)
    token = issued.get('data', issued)['access_token']
    api('/m2m/authority-control-plane/companies/' + custody.COMPANY + '/network-registry', bearer=token)


def maintain(role, revision, pin, token, renew, store=STORE):
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    identity, credential = eligible(metadata(pin), role, revision, now)
    previous, values = checked_store(store)
    secret = locate(values, identity, credential)
    due = timestamp(credential['expiresAt']) - now <= WARNING_SECONDS
    if not renew:
        return {'role': role, 'due': due, 'version': credential['version'], 'state': 'READ_ONLY'}
    if not due:
        authenticate(identity, secret)
        return {'role': role, 'due': False, 'version': credential['version'], 'state': 'VERIFIED_NO_ROTATION'}
    # Re-read all pins immediately before the irreversible canonical rotation.
    identity2, credential2 = eligible(metadata(pin), role, revision, dt.datetime.now(dt.timezone.utc).timestamp())
    require(identity2 == identity and credential2 == credential and checked_store(store)[0] == previous, 'BASELINE_CHANGED')
    issued = api('/auth/deploy/machines/' + identity['id'] + '/credentials/rotate', {'expiresInDays': 1}, bearer=token, expected=201)
    issued = issued.get('data', issued)
    require(issued['clientId'] == identity['id'] and issued['subject'] == identity['subject'] and issued['companyId'] == custody.COMPANY and issued['scopes'] == ['acp:read'], 'ROTATED_IDENTITY_MISMATCH')
    require(now < timestamp(issued['expiresAt']) <= dt.datetime.now(dt.timezone.utc).timestamp() + 86430, 'ROTATED_LIFETIME_MISMATCH')
    version = credential['version'] + 1
    try:
        require(container_pin() == pin, 'CONTAINER_CHANGED')
        append_version(store, role, version, issued, previous)
    except Exception:
        # Rotation already revoked old credentials. No fictional rollback to V2.
        api('/auth/deploy/machines/' + identity['id'] + '/credentials/' + issued['credentialId'] + '/revoke', {'reason': 'Credential maintenance custody publication failed'}, bearer=token, expected=201)
        raise custody.Failure('NEW_CREDENTIAL_REVOKED_CUSTODY_FAILURE') from None
    authenticate(identity, issued['clientSecret'])
    after_identity, after = eligible(metadata(pin), role, revision, dt.datetime.now(dt.timezone.utc).timestamp())
    require(after['id'] == issued['credentialId'] and after['version'] == version and after['lastUsedAt'], 'ROTATION_AUTHENTICATION_NOT_PROVEN')
    locate(checked_store(store)[1], after_identity, after)
    return {'role': role, 'due': True, 'version': version, 'state': 'ROTATED_CUSTODIED_AUTHENTICATED', 'credentialId': after['id'], 'expiresAt': after['expiresAt'], 'formalBindingUnchanged': True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-revision', required=True)
    parser.add_argument('--renew', action='store_true')
    args = parser.parse_args()
    require(os.geteuid() == 0 and re.fullmatch('[0-9a-f]{40}', args.expected_revision), 'ROOT_AND_EXACT_REVISION_REQUIRED')
    checked_store(STORE)
    token = sys.stdin.read().strip() if args.renew else None
    require(not args.renew or bool(token), 'REAL_RELEASE_OIDC_REQUIRED')
    lock = os.open(STORE.parent / '.machine-credential-maintenance.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(lock)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o600, 'LOCK_BOUNDARY_INVALID')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        pin = container_pin()
        for role in TARGETS:
            result = maintain(role, args.expected_revision, pin, token, args.renew)
            print(json.dumps(dict(result, secretsDisplayed=False)), flush=True)
    finally:
        os.close(lock)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, custody.Failure) and re.fullmatch('[A-Z0-9_]+', str(error)) else 'MAINTENANCE_FAILED_REQUIRES_METADATA_RECONCILIATION'
        # Do not retry rotation on timeout: it may already have committed.
        print(json.dumps({'state': 'ESCALATED', 'code': code, 'secretsDisplayed': False}), flush=True)
        sys.exit(1)
