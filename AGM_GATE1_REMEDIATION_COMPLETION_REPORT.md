# AGM Gate 1 remediation completion report

Date: 2026-07-28
Target: `agm-cloud-validation-01`
Remote operator account: `agmops`
Verdict: **PASS / REMEDIATED**

## Official production secret source

The official production source is now:

- `/opt/agm/production/secrets/agm-production.env`
- integrity manifest:
  `/opt/agm/production/secrets/agm-production.env.manifest`
- Turn Admin bootstrap secret:
  `/opt/agm/production/secrets/agm-production-bootstrap.secrets`

All three files are owned by `root:root` and use mode `0600`. The containing secrets
directory uses mode `0700`.

## Secret provenance

- `POSTGRES_PASSWORD`: generated on the target with OpenSSL.
- `JWT_SECRET`: generated on the target with OpenSSL.
- `AGM_TURN_ADMIN_BOOTSTRAP_PIN`: generated on the target with OpenSSL.
- `AGM_TURN_ADMIN_PIN_HASH`: derived with bcrypt cost 12 inside the existing protected
  AGM validation API container.
- `OPENAI_API_KEY`: reused without display from the existing protected
  `/opt/agm/secrets/agm-validation.env`.
- Non-secret production values were taken from the approved production contract.

No secret value left the remote host or appeared in command output or this report.

## Integrity

- Production env SHA-256:
  `af05f38db3237af9c949c7c86ddc6693c826c102ba86c696f1dc7f98fd96888e`
- Manifest SHA-256:
  `c0dc759e69e25f57f84a10a63950b6f020ddf7363d2860cd1f96db564d7cb7fe`
- Protected OpenAI source SHA-256:
  `2ef14786a239c4e50e88e95ec16aafeb66c9be88e487195c3b1324593aecb6e8`

The env checksum matches the checksum recorded inside the root-only manifest.

## Gate 1 read-only rerun

- File exists: PASS
- Owner/group `root:root`: PASS
- Mode `0600`: PASS
- Manifest exists and is `0600`: PASS
- Bootstrap secret exists and is `0600`: PASS
- Required keys present exactly once: PASS
- Empty values: none
- Placeholder values: none
- PostgreSQL password policy: PASS
- JWT secret policy: PASS
- Turn Admin bcrypt structure: PASS
- OpenAI value matches its protected source: PASS
- DATABASE_URL destination:
  `postgres:5432/agm_production` (credentials redacted)
- Docker env loading test: PASS
- Required runtime variables loaded: 8/8

## Installed variable names

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `OPENAI_API_KEY`
- `OPENAI_TRANSLATION_MODEL`
- `OPENAI_TRANSLATION_TIMEOUT_MS`
- `AGM_TURN_ADMIN_PIN_HASH`
- `NODE_ENV`
- `PORT`
- `API_HOST`
- `TRUST_PROXY_HOPS`
- `CORS_ALLOWED_ORIGINS`
- `DATABASE_URL`
- `AGM_API_HOST_PORT`
- `AGM_BACKUP_DIR`
- `AGM_BACKUP_RETENTION_COUNT`

## Conservation statement

- No deployment occurred.
- The approved Docker artefact was not rebuilt or modified.
- No database or migration was accessed.
- No service was restarted or reconfigured.
- No Cloudflare state was accessed or changed.
- Only the authorized production secrets directory and three protected files were
  created.

Gate 1 is closed with PASS. Further production gates require their applicable
authorization and must not infer deployment approval from this result.
