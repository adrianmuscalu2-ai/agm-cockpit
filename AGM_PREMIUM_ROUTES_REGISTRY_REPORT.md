# AGM Premium Routes Registry - Validation Report

Date: 2026-07-18
Branch: `feature/agm-premium-foundation`
Status: PASS
Merge: NOT PERFORMED
Publication: NOT PERFORMED

## Scope

- introduced a dedicated registry for Premium routes;
- centralized the `/premium` and `/premium/team` route definitions;
- centralized route-to-view and view-to-route resolution for Premium;
- removed the duplicated Premium route mappings from `main.ts`;
- preserved all existing URLs and navigation behavior.

## Isolation

No functional change was made to:

- AGM Basic screens, routes, or workflows;
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
Android debug build: PASS
Public API endpoint in APK: PRESENT
Localhost translation fallback in APK: NONE
```

Validated APK SHA-256:

```text
E9A2890CC1A1E18D4485B50CF621A5C6C9B7AF106109A9206BC879D5C8B5385D
```

## Final validation

The functional audit was officially confirmed on Desktop and Android:

- `/premium`: PASS;
- `/premium/team`: PASS;
- Premium to Team and Team to Premium: PASS;
- return to AGM Basic: PASS;
- browser or WebView Back/Forward: PASS;
- direct access after application relaunch: PASS;
- no functional or navigation errors identified.

## Decision

Premium Routes Registry result: **PASS**

The stage is approved for a dedicated Git checkpoint. No merge or publication is
included in this stage.
