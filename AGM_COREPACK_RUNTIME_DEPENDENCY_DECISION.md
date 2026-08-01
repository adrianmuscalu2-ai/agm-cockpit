# AGM Corepack/npm runtime dependency decision

Date: 2026-07-28
Scope: approved image
Decision: **TEMPORARY CONDITIONAL ACCEPTANCE**

## Finding

The approved image invokes `pnpm` through Corepack at startup. On a fresh container,
Corepack downloads pinned package-manager version `pnpm@9.12.3` from the public npm
registry.

The production-copy rehearsal proved that:

- the download completed successfully on Hetzner;
- migrations and API startup completed;
- the package-manager version is pinned;
- repeated startup of the same container can reuse its writable-layer cache.

The image is therefore executable, but not fully self-contained for a fresh-container
or container-recreation event.

## Current-release decision

The dependency is accepted only for the next controlled deployment attempt under all
of these conditions:

1. npm registry reachability is checked before the write freeze.
2. The first `agm-production-api` container start completes while the Windows
   fallback remains active.
3. API live, ready and migration checks pass before any connector transition.
4. Failure to download or start produces STOP; the public route remains on Windows.
5. After successful startup, lifecycle operations use restart of the same container,
   preserving the Corepack cache.
6. Container recreation is prohibited unless registry reachability and fallback
   readiness are reconfirmed.
7. The Windows fallback remains available through the acceptance/soak window.

This acceptance does not authorize deployment by itself.

## Mandatory permanent remediation

A future approved artefact must:

- install and activate the pinned pnpm version during image build;
- prove cold startup with registry/network access disabled;
- run `prisma migrate deploy` and API startup without downloading packages;
- retain the non-root runtime user;
- receive a new image digest and the full artefact validation applicable to a changed
  image.

The current validated image must not be rebuilt or silently replaced under the
targeted remediation mandate.

## Risk statement

Residual risk is limited to fresh-container startup/recreation while npm is
unavailable. The single-active connector procedure prevents this risk from affecting
public Production during initial deployment because routing cannot change before API
health PASS.
