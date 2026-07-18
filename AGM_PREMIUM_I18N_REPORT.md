# AGM Premium i18n Separation - Validation Report

Date: 2026-07-18
Branch: `feature/agm-premium-foundation`
Status: PASS
Merge: NOT PERFORMED
Publication: NOT PERFORMED

## Scope

- introduced a dedicated Premium i18n dictionary;
- moved all existing Premium strings out of the main application dictionary;
- preserved the existing i18n lookup and Romanian fallback behavior;
- retained the exact Premium keys and displayed values;
- added no screen, route, active agent, external call, or storage behavior.

## Dictionary inventory

```text
Romanian Premium keys: 46
German Premium keys: 46
English Premium keys: 46
Total Premium entries: 138
```

## Isolation

No functional change was made to:

- AGM Basic screens, strings, routes, or workflows;
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
Android debug build: PASS
Premium RO text in APK: PRESENT
Premium DE text in APK: PRESENT
Premium EN text in APK: PRESENT
Public API endpoint in APK: PRESENT
Localhost translation fallback in APK: NONE
```

Validated APK SHA-256:

```text
DA3EAA230C206EC86431C81860F49EB40F6467B8CAB11FE176710DB4F26F7DD6
```

## Final validation

The visual and functional audit was officially confirmed:

- Desktop: PASS;
- Android: PASS;
- Romanian: PASS;
- German: PASS;
- English: PASS;
- diacritics and displayed text are correct;
- navigation and return to AGM Basic work correctly;
- no regressions were identified.

## Decision

Premium i18n Separation result: **PASS**

The stage is approved for a dedicated Git checkpoint. No merge or publication is
included in this stage.
