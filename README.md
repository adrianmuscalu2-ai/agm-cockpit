# AGM

AGM is an AI-assisted vehicle transport management system.

## OpenAI Build Presentation

For the OpenAI Build demo, the official presentation surface is AGM Basic.

- AGM Basic is the version shown for judging and demonstration.
- AGM Premium remains under development and is isolated from the official demo.
- `POC01` and `POC02` are closed and preserved as protected baselines.

Presentation highlights:

- RO / DE / EN translation
- OCR capture and local text recognition
- Voice dictation and voice playback
- Email Assistant and text correction
- Turn Command Center and incident journal
- Android-ready web app with Capacitor packaging

Recommended demo flow:

1. Start on the AGM Basic home screen.
2. Show translation, OCR, and voice features.
3. Show profile and legal acceptance flows.
4. Show Email Assistant and Turn Command Center.
5. Confirm Android packaging and stable build status.

Submission checklist:

- stable Basic demo path
- English project description
- short demo video
- code repository link
- final review of the submission package

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

For silent startup after Windows logon, automatic service recovery, verification, and rollback, see [WINDOWS_AUTOSTART.md](./WINDOWS_AUTOSTART.md).

For a dry run without starting services:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-AGM.ps1 -DryRun
```

## Build and Verification

Typical validation commands for the presentation build:

```powershell
corepack pnpm --filter @agm/web build
corepack pnpm --filter @agm/api test
corepack pnpm --filter @agm/web test:premium
corepack pnpm --filter @agm/web android:sync
git diff --check
```

The repo is currently organized so that AGM Basic is the demo surface while AGM Premium stays out of the official presentation path.
