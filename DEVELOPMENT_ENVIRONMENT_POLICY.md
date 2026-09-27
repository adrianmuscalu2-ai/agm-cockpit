# AGM isolated development environment

Status: selective extraction from the archived `development/post-contest` workspace, reconciled with A.G.M. Cockpit 1.6.0.

## Isolation contract

- Use a dedicated development worktree or clone. Do not develop in a frozen Production or dirty preservation worktree.
- API: `127.0.0.1:3100`.
- Web: `127.0.0.1:5175`.
- PostgreSQL: `127.0.0.1:55432`.
- Port `5173` is reserved for Fitness and port `5174` is reserved for the canonical AGM Cockpit Browser target. Development must not bind either port.
- The development database, named volume, credentials, and service name are independent from Production, validation, field-test, and other local databases.
- Production credentials, database dumps, tunnels, hostnames, tokens, signing keys, and `.env` files must never be copied into this environment.
- `development.env` is local-only and ignored by Git. Only `development.env.example` belongs in source control.

## Start locally

1. Copy `development.env.example` to `development.env` and replace every `replace-with-...` value with a development-only value.
2. Start only the isolated database:

   ```powershell
   docker compose --env-file development.env -f docker-compose.development.yml up -d postgres
   ```

3. Generate Prisma and apply the approved development migration workflow using `DATABASE_URL` from `development.env`.
4. Start the API with `development.env`; it must listen only on `127.0.0.1:3100`.
5. Start Web explicitly on `127.0.0.1:5175` and use `http://127.0.0.1:3100/api/v1` as its API base.
6. Run `node scripts/validate-development-environment.mjs` before using or changing the environment.

Never use `api.agmcockpit.com`, `app.agmcockpit.com`, a Production database address, or a public bind address in this development profile.

## Change and promotion rules

1. New work starts on a dedicated feature branch from an explicitly recorded baseline.
2. Every change requires deterministic tests, build evidence, and a short reconciliation report.
3. Development configuration must not be copied into Production compose or Production secrets.
4. Promotion uses a dedicated integration branch and normal release authorization; this profile cannot publish or deploy.
5. If integration fails, abandon the integration branch. Do not reset or rewrite protected baselines or preservation branches.

## Stop and cleanup

Stop the isolated services with:

```powershell
docker compose --env-file development.env -f docker-compose.development.yml down
```

Do not add `--volumes` unless destruction of the isolated development database has been separately authorized and its required data is preserved.
