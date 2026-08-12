# Gmail external validation — local only

Status: AUTHORIZED / PRE-PROVISIONING

## Fixed identity and environment

- Gmail account to authorize: `agm.transporte.logistik@gmail.com`
- Google Cloud project display name: `AGM Cockpit Local Validation`
- OAuth client display name: `AGM Cockpit Local Gmail Validation`
- OAuth client type: Desktop application
- Environment: `LOCAL VALIDATION`
- Loopback redirect URI: `http://127.0.0.1:53682/oauth2/callback`
- Scopes: `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/gmail.readonly`

The actual Google Cloud project ID and OAuth client ID must be recorded only
after Google creates them. A client ID is not a secret; the client secret,
authorization code, access token and refresh token are secrets and must never
be copied into chat, command history, screenshots, commits or evidence.

## Provisioning gate

1. Use Codex Desktop with exact `iab` selection.
2. Open only the official Google Cloud console.
3. Reuse a suitable AGM-owned project/client if one already exists and exactly
   matches this local-validation purpose; otherwise create the named project
   and Desktop OAuth client.
4. Enable Gmail API. Create a Pub/Sub topic only when Gmail `watch` is prepared.
5. Do not enable billing, add unrelated APIs, change Production, or grant broad
   IAM roles.
6. Configure the OAuth consent screen with only the two listed Gmail scopes.
7. Record project ID, client ID, and verified loopback redirect. Never record
   the client secret.
8. Stop before account authorization and return the preflight to VS Code.

## Mandatory disclosure before owner authorization

VS Code must display the exact Gmail account, actual project ID/display name,
actual OAuth client ID/display name, LOCAL VALIDATION environment, validated
redirect URI, exact scopes and the generated official accounts.google.com OAuth
link. Only then may Product Owner authorize manually.

## External E2E matrix

1. real outbound;
2. real inbound/reply;
3. controlled API restart and automatic OAuth refresh;
4. controlled provider failure and retry;
5. maximum five retry attempts;
6. confirmed-message retry denial;
7. provider-event/message deduplication;
8. tenant isolation.

No Production, Basic or Fitness change is allowed.
