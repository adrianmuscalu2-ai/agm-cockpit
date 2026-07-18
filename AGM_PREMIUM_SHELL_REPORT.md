# AGM Premium Shell - Validation Report

Date: 2026-07-18
Branch: `feature/agm-premium-foundation`
Status: PASS
Merge: NOT PERFORMED
Publication: NOT PERFORMED

## Scope

- introduced a shared `PremiumShell` renderer;
- centralized the Premium brand, header, content frame, navigation slot, and footer;
- migrated `/premium` and `/premium/team` to the shared shell;
- preserved the existing routes, labels, CSS classes, and navigation behavior;
- introduced no active agent, external call, storage, permission, or API change.

## Isolation

No functional change was made to:

- AGM Basic;
- API or PostgreSQL;
- Cloudflare or infrastructure;
- production endpoints or environment variables;
- Android permissions or native plugins;
- backup services or timers.

## Automated validation

```text
Production endpoint validation: PASS
TypeScript no-emit: PASS
Vite production build: PASS
/ response: HTTP 200
/premium response: HTTP 200
/premium/team response: HTTP 200
Localhost translation fallback in APK: NONE
Premium team route in APK: PRESENT
```

## Android incident

The first Android check used Capacitor assets dated 2026-07-16, while the current
Premium build was produced on 2026-07-18. The Android bundle was synchronized and a
new debug APK was generated. No functional code or architecture change was required.

Validated APK SHA-256:

```text
CD9B5F0C7742CE2682695EB330256F9ADBBD2CC0402E6444A31C4CE770DB29ED
```

## Final validation

The functional and visual audit was officially confirmed:

- Desktop: PASS;
- Android: PASS;
- navigation is correct on both platforms;
- pages fit their viewports correctly;
- no visual or functional errors were identified;
- AGM Basic remains stable and protected.

## Decision

Premium Shell result: **PASS**

The stage is approved for a dedicated Git checkpoint. No merge or publication is
included in this stage.
