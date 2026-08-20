# AGM Cockpit canonical source manifest

Canonical scope for the auth/session LTE incident:

- `apps/api/` — API source, auth/session implementation, tests and package metadata.
- `apps/web/src/` — Web application source and auth client/runtime.
- `apps/web/android/` — Capacitor Android shell and WebView configuration.
- `apps/web/*.html`, `apps/web/package.json`, `apps/web/capacitor.config.ts` — Web/Android entry configuration.
- `prisma/` — schema and production migrations required by the API.
- `deploy/production/` — approved lifecycle/runbook material; no credentials.
- `config/` — non-secret runtime and governance configuration required by builds.
- root package manifests and lockfiles required for reproducible builds.

Excluded from canonical source:

`tmp/`, `.tmp/`, `logs/`, `cache/`, `dist/`, `build/`, `artifacts/`, `evidence/`, screenshots, APK outputs, local secrets, encrypted credential stores, generated reports, experiments and unrelated audit material.

Auth fix included:

- Production refresh cookie: `SameSite=None; Secure`.
- Android WebView: explicit third-party cookie acceptance.
