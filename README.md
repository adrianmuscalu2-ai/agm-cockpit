# AGM

AGM is an AI-assisted vehicle transport management system.

## Official Roadmap

The official AGM roadmap is maintained in [ROADMAP.md](./ROADMAP.md).

It separates:

- AGM Basic;
- AGM Premium;
- AGM Future Backlog.

Governance and release process:

- [AI_GOVERNANCE.md](./AI_GOVERNANCE.md)
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)

This repository starts with Implementation Phase 1:

```text
Create Transport -> Accept Transport -> AuditEvent -> BusinessValidationReport -> TransportJobStateHistory
```

The implementation must follow `AGM Architecture Specification v1.0`.

## One Click Startup

Use `Start_AGM.bat` from the repository root to start AGM with one double-click.

The starter detects the environment from `.env`:

- `DATABASE_URL` with `localhost`, `127.0.0.1`, or `host.docker.internal` starts the PC/Docker flow.
- `DATABASE_URL` with a Neon host, `pooler`, or `sslmode=require` starts the Laptop/Neon flow.

PC/Docker flow:

1. Checks whether Docker Engine is available.
2. Starts Docker Desktop if needed.
3. Waits for Docker Engine.
4. Starts PostgreSQL with Docker Compose when it is not already running.
5. Starts the API with `pnpm api:dev` when port `3000` is free.
6. Starts the frontend with `pnpm dev` when port `5173` is free.
7. Opens `http://localhost:5173`.

Laptop/Neon flow:

1. Detects the Neon database configuration.
2. Does not start Docker.
3. Starts the API with `pnpm api:dev` when port `3000` is free.
4. Starts the frontend with `pnpm dev` when port `5173` is free.
5. Opens `http://localhost:5173`.

Each started service opens in its own command window. Existing processes on the expected ports are reused instead of started again.

For a dry run without starting services:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-AGM.ps1 -DryRun
```
