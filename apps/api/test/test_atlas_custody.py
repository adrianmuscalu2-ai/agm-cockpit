"""Synthetic isolated fixtures only; never connect to AGM or read its store."""
import importlib.util
import io
import os
import tempfile
import unittest
import urllib.error
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('atlas_custody', Path(__file__).parents[1] / 'scripts/production-atlas-custody.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
CLIENT = '00000000-0000-4000-8000-000000000011'
CREDENTIAL = '00000000-0000-4000-8000-000000000012'
SECRET = CREDENTIAL + '.' + 'x' * 64
DATA = dict(clientId=CLIENT, credentialId=CREDENTIAL, clientSecret=SECRET,
            companyId=m.COMPANY, subject='atlas-operations', scopes=m.SCOPES, expiresAt='2027-11-08T20:00:00.000Z')
IDENTITY = dict(id=CLIENT, companyId=m.COMPANY, subject='atlas-operations', status='ACTIVE', scopes=m.SCOPES)
BINDINGS = {m.PREFIX + key: DATA[field] for key, field in
            [('CLIENT_ID', 'clientId'), ('CREDENTIAL_ID', 'credentialId'), ('CLIENT_SECRET', 'clientSecret'), ('EXPIRES_AT', 'expiresAt')]}
OBSERVED = dict(identities=[IDENTITY], postRecovery={})


class CustodyTests(unittest.TestCase):
    def test_no_account_or_scope_substitution(self):
        for change in [dict(companyId=CLIENT), dict(subject='other'), dict(scopes=['acp:read']),
                       dict(clientSecret=SECRET + '\nINJECTED=true'), dict(expiresAt='bad\nVALUE=true')]:
            with self.subTest(change=change), self.assertRaises(m.Failure):
                m.validate_response(dict(DATA, **change))

    def test_existing_secret_store_preserved_byte_for_byte_and_mode(self):
        if os.geteuid() != 0:
            self.skipTest('Root-owned Linux fixture required; run with sudo on isolated CI')
        with tempfile.TemporaryDirectory() as directory:
            store = Path(directory) / 'existing.env'
            original = b'# existing managed store\nJWT_SECRET=synthetic-fixture\n'
            store.write_bytes(original)
            store.chmod(0o600)
            m.append_custody(DATA, original, store)
            self.assertTrue(store.read_bytes().startswith(original))
            self.assertEqual(m.read_store(store)[1], BINDINGS)
            self.assertEqual(store.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(m.Failure):
                m.append_custody(DATA, original, store)

    def test_wrong_permissions_fail_before_append(self):
        if os.geteuid() != 0:
            self.skipTest('Root-owned Linux fixture required')
        with tempfile.TemporaryDirectory() as directory:
            store = Path(directory) / 'existing.env'
            store.write_text('OTHER=fixture\n')
            store.chmod(0o644)
            with self.assertRaises(m.Failure):
                m.read_store(store)

    @patch.object(m.os, 'geteuid', return_value=0)
    @patch.object(m, 'read_store', return_value=(b'OTHER=fixture\n', {}))
    @patch.object(m, 'registry', return_value=OBSERVED)
    @patch.object(m, 'api')
    def test_default_inspection_never_calls_mutation_api(self, api, registry, store, uid):
        self.assertEqual(m.run()['mode'], 'READ_ONLY')
        api.assert_not_called()

    @patch.object(m.os, 'geteuid', return_value=0)
    @patch.object(m, 'read_store', return_value=(b'OTHER=fixture\n', {}))
    @patch.object(m, 'registry', return_value=dict(OBSERVED, identities=[IDENTITY, IDENTITY]))
    @patch.object(m, 'api')
    def test_duplicate_registry_fails_without_provisioning(self, api, registry, store, uid):
        with self.assertRaisesRegex(m.Failure, 'NOT_UNIQUE'):
            m.run(True)
        api.assert_not_called()

    @patch.object(m.os, 'geteuid', return_value=0)
    @patch.object(m, 'read_store', return_value=(b'OTHER=fixture\n', BINDINGS))
    @patch.object(m, 'registry', return_value=OBSERVED)
    @patch.object(m, 'api', side_effect=[dict(access_token='fixture-token', scope='acp:read governance:propose'), dict(data=[]), m.Failure('ATLAS_API_HTTP_401')])
    def test_existing_identity_only_authenticates_no_create_or_rotate(self, api, registry, store, uid):
        with patch.object(m.sys, 'stdin', io.StringIO('fixture.payload.signature')):
            result = m.run(True)
        self.assertFalse(result['created'])
        self.assertEqual([call.args[0] for call in api.call_args_list],
                         ['/auth/m2m/token', f'/m2m/authority-control-plane/companies/{m.COMPANY}/network-registry', '/auth/me'])
        self.assertNotIn(SECRET, str(result))

    @patch.object(m.os, 'geteuid', return_value=0)
    @patch.object(m, 'read_store', return_value=(b'OTHER=fixture\n', {}))
    @patch.object(m, 'registry', return_value=OBSERVED)
    @patch.object(m, 'api')
    def test_missing_existing_custody_never_rotates_or_creates(self, api, registry, store, uid):
        with patch.object(m.sys, 'stdin', io.StringIO('fixture.payload.signature')):
            with self.assertRaisesRegex(m.Failure, 'NO_AUTOMATIC_ROTATION'):
                m.run(True)
        api.assert_not_called()

    @patch.object(m.os, 'geteuid', return_value=0)
    @patch.object(m, 'read_store', return_value=(b'OTHER=fixture\n', {}))
    @patch.object(m, 'registry', return_value=dict(OBSERVED, identities=[]))
    @patch.object(m, 'append_custody', side_effect=OSError('synthetic-custody-failure'))
    @patch.object(m, 'api', side_effect=[dict(data=DATA), dict(data={})])
    def test_new_credential_revoked_on_custody_failure(self, api, append, registry, store, uid):
        with patch.object(m.sys, 'stdin', io.StringIO('fixture.payload.signature')):
            with self.assertRaisesRegex(m.Failure, 'REVOKED_AFTER_CUSTODY_FAILURE'):
                m.run(True)
        self.assertEqual(api.call_args_list[1].args[0], f'/auth/deploy/machines/{CLIENT}/credentials/{CREDENTIAL}/revoke')

    @patch.object(m.os, 'geteuid', return_value=0)
    @patch.object(m, 'read_store', side_effect=[(b'OTHER=fixture\n', {}), (b'OTHER=fixture\n', BINDINGS)])
    @patch.object(m, 'registry', side_effect=[dict(OBSERVED, identities=[]), OBSERVED])
    @patch.object(m, 'append_custody')
    @patch.object(m, 'api', side_effect=[dict(data=DATA), dict(access_token='fixture-token', scope='acp:read governance:propose'), dict(data=[]), m.Failure('ATLAS_API_HTTP_401')])
    def test_new_canonical_identity_custodied_then_authenticates(self, api, append, registry, store, uid):
        with patch.object(m.sys, 'stdin', io.StringIO('fixture.payload.signature')):
            result = m.run(True)
        self.assertTrue(result['created'])
        append.assert_called_once_with(DATA, b'OTHER=fixture\n')
        self.assertEqual(api.call_args_list[0].args[0], '/auth/deploy/machines')
        self.assertEqual(result['authorizedScopes'], m.SCOPES)
        self.assertFalse(result['administrativePrivileges'])
        self.assertNotIn(SECRET, str(result))

    @patch.object(m.os, 'geteuid', return_value=0)
    @patch.object(m, 'read_store', return_value=(b'OTHER=fixture\n', {}))
    @patch.object(m, 'registry', return_value=dict(OBSERVED, identities=[]))
    @patch.object(m, 'api')
    def test_no_oidc_never_provisions(self, api, registry, store, uid):
        with patch.object(m.sys, 'stdin', io.StringIO('')):
            with self.assertRaisesRegex(m.Failure, 'OFFICIAL_RELEASE_OIDC_REQUIRED'):
                m.run(True)
        api.assert_not_called()

    def test_redirects_do_not_forward_authorization(self):
        self.assertIsNone(m.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.invalid'))

    def test_http_failure_reports_boundary_not_provider_body_or_credentials(self):
        raw = 'synthetic-private-response-value'
        result = SimpleNamespace(returncode=0, stdout='HTTP/2 403\ncontent-type: text/html\nserver: cloudflare\ncf-mitigated: challenge\n\n' + raw + '\nAGM_HTTP_STATUS:403')
        with patch.object(m.subprocess, 'run', return_value=result) as transport:
            with self.assertRaisesRegex(m.Failure, 'HTTP_403'):
                m.api('/auth/deploy/machines', {}, 'synthetic-bearer', 201)
            self.assertEqual(transport.call_args.args[0], ['curl', '--disable', '--config', '-'])
            self.assertIn('synthetic-bearer', transport.call_args.kwargs['input'])
        self.assertEqual(m.DIAGNOSTIC['operation'], 'MACHINE_PROVISION')
        self.assertTrue(m.DIAGNOSTIC['explicitChallenge'])
        self.assertNotIn(raw, str(m.DIAGNOSTIC))
        self.assertNotIn('synthetic-bearer', str(m.DIAGNOSTIC))

    def test_existing_curl_configuration_uses_stdin_and_parses_only_json(self):
        result = SimpleNamespace(returncode=0, stdout='HTTP/2 200\ncontent-type: application/json\n\n{"data": []}\nAGM_HTTP_STATUS:200')
        with patch.object(m.subprocess, 'run', return_value=result) as transport:
            self.assertEqual(m.api('/auth/me', bearer='synthetic-bearer'), {'data': []})
            self.assertNotIn('synthetic-bearer', str(transport.call_args.args))
            self.assertNotIn('user-agent', transport.call_args.kwargs['input'])
            self.assertNotIn('location', transport.call_args.kwargs['input'])

    def test_explicit_boundary_probe_never_sends_credentials_or_a_valid_mutation(self):
        errors = [urllib.error.HTTPError(m.API, 401, '', {'Content-Type': 'application/json'}, io.BytesIO()),
                  urllib.error.HTTPError(m.API, 403, '', {'Content-Type': 'text/html'}, io.BytesIO())]
        with patch.object(m.urllib.request, 'build_opener') as build, patch.object(m.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout='401')), patch.object(m, 'api', side_effect=m.Failure('ATLAS_API_HTTP_401')) as configured:
            build.return_value.open.side_effect = errors
            results = m.inspect_http_boundary()
            for call in build.return_value.open.call_args_list:
                self.assertNotIn('Authorization', call.args[0].headers)
                self.assertIn(call.args[0].data, [None, b'{}'])
            configured.assert_called_once_with('/auth/me')
        self.assertEqual([result['httpStatus'] for result in results], [401, 403, 401, 401])
        self.assertTrue(all(result['credentialsSent'] is False for result in results))


if __name__ == '__main__':
    unittest.main()
