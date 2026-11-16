"""Isolated Linux custody tests: no AGM connection, secret store or deployment."""
import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('maintenance', Path(__file__).parents[1] / 'scripts/production-credential-maintenance.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
ROLE = 'VALIDATOR'
ID, SUBJECT = m.TARGETS[ROLE]
CID = '00000000-0000-4000-8000-000000000003'
ISSUED = dict(clientId=ID, subject=SUBJECT, companyId=m.custody.COMPANY, scopes=['acp:read'], credentialId=CID, clientSecret=CID + '.' + 'x' * 64, expiresAt='2026-11-17T12:00:00Z')


class CredentialMaintenanceTests(unittest.TestCase):
    def test_append_preserves_history_and_rejects_repeat_and_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Path(directory) / 'custody.env'
            store.write_bytes(b'HISTORICAL=retained\n')
            store.chmod(0o600)
            before = store.read_bytes()
            m.append_version(store, ROLE, 3, ISSUED, before)
            after, values = m.checked_store(store)
            self.assertTrue(after.startswith(before))
            self.assertEqual(values['PR36_VALIDATOR_V3_CREDENTIAL_ID'], CID)
            with self.assertRaises(m.custody.Failure):
                m.append_version(store, ROLE, 3, ISSUED, after)
            link = Path(directory) / 'link'
            link.symlink_to(store)
            with self.assertRaises(OSError):
                m.checked_store(link)
            self.assertEqual(store.read_bytes(), after)

    def test_custody_must_match_current_database_version_and_expiry(self):
        identity = {'id': ID}
        credential = {'id': CID, 'expiresAt': ISSUED['expiresAt']}
        bindings = {'PR36_VALIDATOR_V3_' + k: ISSUED[v] for k, v in [('CLIENT_ID', 'clientId'), ('CREDENTIAL_ID', 'credentialId'), ('CLIENT_SECRET', 'clientSecret'), ('EXPIRES_AT', 'expiresAt')]}
        self.assertEqual(m.locate(bindings, identity, credential), ISSUED['clientSecret'])
        for change in [dict(id='other'), dict(expiresAt='2026-11-18T12:00:00Z')]:
            with self.assertRaises(m.custody.Failure):
                m.locate(bindings, identity, dict(credential, **change))

    def test_newline_injection_and_broad_store_permissions_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Path(directory) / 'custody.env'
            store.write_bytes(b'OLD=retained\n')
            store.chmod(0o600)
            with self.assertRaises(m.custody.Failure):
                m.append_version(store, ROLE, 3, dict(ISSUED, clientSecret=ISSUED['clientSecret'] + '\nINJECTED=true'), store.read_bytes())
            store.chmod(0o644)
            with self.assertRaises(m.custody.Failure):
                m.checked_store(store)

    def test_no_rotation_when_not_due_and_no_blind_retry_after_timeout(self):
        now = m.dt.datetime.now(m.dt.timezone.utc).timestamp()
        expiry = m.dt.datetime.fromtimestamp(now + 86400, m.dt.timezone.utc).isoformat()
        identity = {'id': ID, 'subject': SUBJECT}
        credential = {'id': CID, 'version': 3, 'expiresAt': expiry}
        with patch.object(m, 'metadata'), patch.object(m, 'eligible', return_value=(identity, credential)), patch.object(m, 'checked_store', return_value=(b'old', {})), patch.object(m, 'locate', return_value='fixture'), patch.object(m, 'authenticate') as auth, patch.object(m, 'api') as api:
            result = m.maintain(ROLE, 'a' * 40, [], 'oidc-fixture', True)
            self.assertEqual(result['state'], 'VERIFIED_NO_ROTATION')
            auth.assert_called_once()
            api.assert_not_called()
            credential['expiresAt'] = '2026-01-01T00:00:00Z'
            api.side_effect = m.custody.Failure('ATLAS_API_HTTP_TIMEOUT')
            with self.assertRaises(m.custody.Failure):
                m.maintain(ROLE, 'a' * 40, [], 'oidc-fixture', True)
            self.assertEqual(api.call_count, 1)

    def test_rotation_publication_authentication_and_failed_publication_revocation(self):
        now = m.dt.datetime.now(m.dt.timezone.utc).timestamp()
        issued = dict(ISSUED, expiresAt=m.dt.datetime.fromtimestamp(now + 86400, m.dt.timezone.utc).isoformat())
        old_id = '00000000-0000-4000-8000-000000000002'
        old = {'id': old_id, 'version': 2, 'expiresAt': '2026-01-01T00:00:00Z'}
        new = {'id': CID, 'version': 3, 'expiresAt': issued['expiresAt'], 'lastUsedAt': '2026-11-16T12:00:01Z'}
        identity = {'id': ID, 'subject': SUBJECT}
        for publish_failure in [False, True]:
            with self.subTest(publish_failure=publish_failure), tempfile.TemporaryDirectory() as directory:
                store = Path(directory) / 'custody.env'
                store.write_text(f'PR33_VALIDATOR_V2_CLIENT_ID={ID}\nPR33_VALIDATOR_V2_CREDENTIAL_ID={old_id}\nPR33_VALIDATOR_V2_EXPIRES_AT={old["expiresAt"]}\nPR33_VALIDATOR_V2_CLIENT_SECRET=fixture\n')
                store.chmod(0o600)
                previous = store.read_bytes()
                with patch.object(m, 'metadata'), patch.object(m, 'container_pin', return_value=['pin']), patch.object(m, 'eligible', side_effect=[(identity, old), (identity, old), (identity, new)]), patch.object(m, 'api', return_value={'data': issued}) as api, patch.object(m, 'authenticate') as auth:
                    if publish_failure:
                        with patch.object(m, 'append_version', side_effect=OSError('simulated disk failure')):
                            with self.assertRaisesRegex(m.custody.Failure, 'NEW_CREDENTIAL_REVOKED_CUSTODY_FAILURE'):
                                m.maintain(ROLE, 'a' * 40, ['pin'], 'oidc-fixture', True, store)
                        self.assertTrue(api.call_args_list[-1].args[0].endswith('/' + CID + '/revoke'))
                        auth.assert_not_called()
                    else:
                        result = m.maintain(ROLE, 'a' * 40, ['pin'], 'oidc-fixture', True, store)
                        self.assertEqual(result['state'], 'ROTATED_CUSTODIED_AUTHENTICATED')
                        self.assertEqual(result['version'], 3)
                        self.assertTrue(store.read_bytes().startswith(previous))
                        self.assertNotIn(issued['clientSecret'], str(result))
                        auth.assert_called_once_with(identity, issued['clientSecret'])

    def test_role_scope_revision_and_mandate_guards(self):
        now = m.dt.datetime.now(m.dt.timezone.utc).timestamp()
        data = {'revision': 'a' * 40, 'database': [{'name': 'agm', 'system': '7665798064781766689'}],
                'identities': [{'id': ID, 'subject': SUBJECT, 'companyId': m.custody.COMPANY, 'status': 'ACTIVE', 'scopes': ['acp:read'], 'credentials': [{'id': CID, 'revokedAt': None}]}],
                'mandates': [{'agentId': SUBJECT, 'mandateKey': 'inspector-failover:' + SUBJECT, 'mode': 'INSPECTOR', 'scopeId': 'premium.architecture', 'expiresAt': m.dt.datetime.fromtimestamp(now + 172800, m.dt.timezone.utc).isoformat()}],
                'actors': [{'id': SUBJECT, 'status': 'ACTIVE', 'roles': [ROLE], 'can_validate': True}],
                'bindings': [{'actor_id': SUBJECT, 'principal_id': ID, 'status': 'BOUND', 'company_id': m.custody.COMPANY}]}
        self.assertEqual(m.eligible(data, ROLE, 'a' * 40, now)[0]['id'], ID)
        for field in ['revision', 'scopes', 'mandates', 'bindings', 'actors', 'wrongMandate', 'reboundPrincipal']:
            broken = copy.deepcopy(data)
            if field == 'revision':
                broken[field] = 'b' * 40
            elif field == 'scopes':
                broken['identities'][0]['scopes'] = ['acp:read', 'governance:propose']
            elif field == 'wrongMandate':
                broken['mandates'][0]['mode'] = 'UNRELATED'
            elif field == 'reboundPrincipal':
                broken['bindings'][0]['actor_id'] = 'different-actor'
            else:
                broken[field] = []
            with self.subTest(field=field), self.assertRaises(m.custody.Failure):
                m.eligible(broken, ROLE, 'a' * 40, now)


if __name__ == '__main__':
    unittest.main()
