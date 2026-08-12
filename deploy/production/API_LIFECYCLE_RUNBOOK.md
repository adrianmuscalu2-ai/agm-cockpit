# AGM Production API lifecycle runbook

Status: prepared and statically validated. Starting the API requires a separate
deployment mandate.

## Official identities

- API container: `agm-production-api`
- API image: `agm-api:cors-credentials-20260810`
- Immutable image ID:
  `sha256:ae6c95ab5489fa279159074980a2c9ecb267ff924c2953e281f59402f38485ba`
- OCI revision: `cors-credentials-20260810`
- PostgreSQL container: `agm-postgres`
- PostgreSQL volume: `app_agm_postgres_data`
- Shared external Docker network: `app_default`
- PostgreSQL DNS aliases on that network: `postgres`, `agm-postgres`
- Protected environment:
  `/opt/agm/production/secrets/agm-production.env`

## Lifecycle authority

`agm-production-api.service` is the only approved systemd lifecycle entrypoint for the
Production API. Direct `docker run`, direct Compose execution and image rebuild are
not approved operational paths.

## Start

After a separate deployment approval has loaded and verified the approved image:

```text
sudo systemctl start agm-production-api.service
```

The unit checks that the exact image digest and official PostgreSQL container exist
before executing Compose with `--no-build --no-deps`.

## Stop

```text
sudo systemctl stop agm-production-api.service
```

The stop operation gives the API 30 seconds and does not stop PostgreSQL.

## Controlled restart

```text
sudo systemctl reload agm-production-api.service
```

Reload maps to a controlled Docker restart of `agm-production-api` with a 30-second
timeout. Validate live, ready, logs and migration idempotence after the restart.

## Autostart

The unit must remain disabled until the deployment mandate explicitly authorizes
activation:

```text
sudo systemctl enable --now agm-production-api.service
```

Enabling before the approved image is loaded and deployment gates pass is prohibited.

## Validation

- `systemd-analyze verify /etc/systemd/system/agm-production-api.service`
- `docker compose --file /opt/agm/production/compose.production.yml config`
- rendered service has no `build`;
- rendered image equals the approved digest;
- the only network is external `app_default`;
- no PostgreSQL service or volume is declared;
- API host binding is `127.0.0.1:3000`;
- unit is disabled/inactive before deployment.
