# AGM formal Release/Stable gate — 2026-08-09

## Decision basis

The Product Owner accepted the frozen functional closure before this gate:

- Android Translator Production API: 9/9 PASS;
- physical Android APK: 9/9 PASS;
- RO/DE/EN regression: PASS;
- Email Assistant DE/FR: PASS;
- Production health, migrations, and logs: PASS;
- Cloudflare, DNS, and database: unchanged;
- `AGM PRODUCT — PASS / FROZEN`.

The sole remaining formal blocker was Integrated Browser Control. It was
resolved through the permanent cross-host route:

`VS CODE BLOCKED → RESCUE → CODEX DESKTOP iab → MINIMAL BROWSER PROBE → HANDOFF`

## Browser evidence

Evidence directory:
`evidence/browser-control/integrated-browser-handoff-2026-08-09/`.

| Gate | Result | Evidence |
|---|---|---|
| Browser Plugin Status | PASS | Desktop handoff preflight |
| Integrated Browser Control Status | PASS | exact live `iab`; browser ID `-74ce-4213-b878-c704ec04a1b9` |
| Browser Session Status | PASS | controllable Desktop session and DOM inspection |
| Target Page Status | PASS | public AGM, local `/`, and local `/email` rendered |
| Public capture | PASS | `public-app-agmcockpit.png` |
| Local main capture | PASS | `local-5174-timeout-state.png` |
| Local route capture | PASS | `local-5174-email.png` |

The local navigation promises exceeded their wait windows, but subsequent
inspection confirmed the exact URLs, rendered DOM, AGM Cockpit 1.3.0, and
`POC 02`. This is a Browser session timing observation, not a product defect.

## Scope integrity

- Fitness on reserved port `5173`: untouched.
- Cloudflare, DNS, database, and Production: untouched.
- Translator, Android, API, and full AGM suites: not reopened.
- No installation or speculative recovery was performed during the accepted
  Desktop proof.

## Checksums

```text
06635EF2E26863BB823824E17FBCBC4132103AF7C822E537813677ADBD09A14A  HANDOFF.md
19AAA47B5EF63725C15F0C844AD22490722908A54966C167CEDC87089B51E150  public-app-agmcockpit.png
4462ED8A9EC3C8F0E6AE94D6B2D9668F44AD0BE92ADC537FCF14CE456CCFB97C  local-5174-timeout-state.png
6C78334FDCDFB02FD4B95E2E82E17DE70FC91CA8C0DB39EFEE1713ADA0A89E3D  local-5174-email.png
```

## Final verdict

- `INTEGRATED BROWSER CONTROL — PASS`
- `BROWSER VISUAL VALIDATION — PASS`
- `RESCUE PILOT — PASS`
- `AGM PRODUCT — PASS / FROZEN`
- `FORMAL RELEASE / STABLE GATE — PASS`
- `AGM STABLE RELEASE — PASS / CLOSED`

The previous Browser-only HOLD is removed. No functional AGM scope is reopened.
