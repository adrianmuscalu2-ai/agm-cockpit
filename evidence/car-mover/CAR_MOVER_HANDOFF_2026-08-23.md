# CAR MOVER — TRANSFER HANDOFF

Date: 2026-08-23
Branch: `agm-canonical-20260820`
Last relevant commit: `fbe0777b9b4ae3db8f6f24752ca728f543d7cd7b`

## Context

**CAR MOVER IS AN AGM PREMIUM COMPONENT — NOT A SEPARATE PROJECT.**

The existing Premium architecture is preserved. No Car Mover component is to be
reconstructed, redesigned, removed, or reinterpreted as a new product.

## Preserved known-good scope

- `/car-mover` Premium Web route and UI
- manual intake
- six vehicle classes
- authenticated API
- complete lifecycle
- takeover/handover protocol
- EventStore and audit references
- tenant/company isolation
- entitlement `car-mover.jobs`
- i18n support
- `CarMoverService.authorize()`
- `POST /api/v1/auth/role-provisioning/car-mover`
- existing Car Mover protocols and designated roles

## Implementation status

### PASS

- Car Mover API P0-01
- web contractual test
- TypeScript and API build
- existing lifecycle, tenant isolation, EventStore, audit and Job File contracts
- Android origin/cache isolation (`https://localhost`)
- Production API image publication and API restart/health readiness
- full API test gate after Prisma client generation

### PARTIAL

- role provisioning endpoint is implemented and deployed;
- endpoint is authenticated and restricted to `OWNER` / `PRODUCT_OWNER`;
- Role/UserRole persistence and AuditEvent creation are implemented;
- GitHub Actions release integration is implemented;
- release execution is blocked before the provisioning POST because the required
  Production credential binding is absent.

### NOT RUN / NOT VERIFIED

- Production execution of `POST /api/v1/auth/role-provisioning/car-mover`
- `CAR_MOVER_ACCESS` entitlement verification in Production
- Production Role + UserRole verification for the target user
- Production AuditEvent/evidence reference verification for provisioning
- authenticated Production Car Mover E2E after provisioning

## Exact blocker

`CAR_MOVER EXECUTION CREDENTIAL / PRODUCTION IDENTITY BOOTSTRAP NOT COMPLETED`

The required GitHub Production environment secret is absent:

`PRODUCTION_ROLE_PROVISIONING_TOKEN`

The target-user binding is also absent:

`CAR_MOVER_TARGET_USER_ID`

No provisioning attempt was bypassed or simulated. The workflow remains
fail-closed.

## Evidence

- Relevant workflow run: `32600031560`
- Workflow URL: `https://github.com/adrianmuscalu2-ai/agm-cockpit/actions/runs/32600031560`
- Verify gate: PASS
- API build: PASS
- Web build: PASS
- API deploy/restart/readiness: PASS
- Provisioning step: FAIL before POST because the Production token binding was empty
- Production environment inventory contained only `PRODUCTION_HOST`,
  `PRODUCTION_USER`, and `PRODUCTION_SSH_KEY`

## Relevant files

- `.github/workflows/production-release.yml`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/role-provisioning.controller.ts`
- `apps/api/src/auth/role-provisioning.service.ts`
- `apps/api/test/role-provisioning.spec.ts`
- `apps/api/src/auth/access-entitlements.contract.ts`
- `apps/api/src/car-mover/car-mover.contract.ts`
- `apps/api/src/car-mover/car-mover.service.ts`
- `apps/api/src/car-mover/car-mover.controller.ts`
- `apps/web/src/premium-access/premium-access.navigation.ts`
- `apps/web/src/premium-voice-shell/premium-assistant.runtime.ts`

## Next executable step

The next team must bind an existing or newly issued least-privilege Production
`OWNER` / `PRODUCT_OWNER` execution identity through the approved Guardian
custody path, without exposing the value or creating a local secret store.
Then rerun the existing workflow, verify the entitlement and audit evidence, and
run the authenticated Car Mover E2E.

## Do not reconstruct

Do not rebuild Car Mover, replace the Premium route, alter lifecycle semantics,
change entitlement rules, replace EventStore/audit, create a parallel registry,
or treat this module as a separate project.

Status: `TRANSFER READY`

