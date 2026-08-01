# AGM — SR-02 Governance Import-Cycle Removal

Date: 2026-07-29  
Roadmap: MC-3B  
Authorized intervention: SR-02 only  
Production deployment performed: no  
Competition material: FROZEN AND PROTECTED

## 1. Result

The known Web import cycle was removed through one neutral type contract:

`apps/web/src/agent-governance.contract.ts`

Both governance modules now depend on this contract for
`AgentGovernanceRecord`. The public type exports previously available from
`agent-governance.registry.ts` remain available through explicit type
re-exports.

The Web import graph changed from one known cycle to zero cycles. The API graph
remains at zero cycles. No runtime value dependency, rendering logic, route,
state, storage, API contract or native behavior was changed.

## 2. Files affected

- `apps/web/src/agent-governance.contract.ts` — added the neutral
  `AgentGovernanceStatus` and `AgentGovernanceRecord` type contract.
- `apps/web/src/agent-governance.registry.ts` — consumes the neutral contract
  and preserves the former public type exports.
- `apps/web/src/monitoring-department.ts` — imports the shared record only as a
  type from the neutral contract.
- `apps/web/scripts/check-import-cycles.ts` — removes the historical Web-cycle
  allowlist and requires zero cycles for both Web and API.
- `AGM_SR02_GOVERNANCE_IMPORT_CYCLE_REMOVAL_REPORT_2026-07-29.md` — records the
  intervention and evidence.

No file was deleted.

## 3. Mandatory-gate ownership

- Implementation owner: Codex, limited to the authorized SR-02 boundary.
- Validator: automated MC-3A, TypeScript, Vite, Jest, Browser-route and Android
  Gradle gates.
- Rollback operator: Version Guardian / repository owner, using the scoped
  rollback described below.

## 4. Baseline

Before the change:

- MC-3A main characterization: PASS.
- MC-3A Android static baseline: PASS.
- MC-3A module boundary characterization: PASS.
- Web graph: 134 files, one known cycle.
- API graph: 70 files, zero cycles.
- SR-01 structural test: PASS.
- Competition-material hashes matched the protection register.

The known cycle was:

`agent-governance.registry.ts -> monitoring-department.ts -> agent-governance.registry.ts`

## 5. Validation results

| Validation | Result |
|---|---|
| Type-only neutral contract | PASS |
| Public registry type re-exports preserved | PASS |
| MC-3A main characterization | PASS |
| MC-3A Android static baseline | PASS |
| MC-3A module boundary characterization | PASS |
| Web import graph | PASS; 135 files, zero cycles |
| API import graph | PASS; 70 files, zero cycles |
| SR-01 structural regression | PASS |
| Web TypeScript and production build | PASS; 158 modules |
| Production API endpoint validation | PASS |
| Browser shell/navigation regression | PASS |
| E6.4–E6.6 regression | PASS |
| Development routes `/`, `/before-departure.html`, `/after-departure.html` | PASS; HTTP 200 for all three |
| API tests | PASS; 8 suites, 31 tests |
| API build | PASS |
| Android `testDebugUnitTest` | BUILD SUCCESSFUL; 53 tasks up-to-date |
| Deleted files | PASS; none |
| Protected competition hashes | PASS; unchanged |

## 6. Behavioral and contract impact

- Rendered governance and monitoring logic is unchanged.
- `agentGovernanceRegistry` contents and order are unchanged.
- Existing consumers can continue importing `AgentGovernanceRecord` and
  `AgentGovernanceStatus` from `agent-governance.registry.ts`.
- The new dependency from both governance modules is type-only and is erased
  from runtime JavaScript.
- Browser, API, Android, production configuration and persisted data are
  unchanged.

## 7. Competition-material protection

The final SHA-256 values remain:

| Protected item | SHA-256 |
|---|---|
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| Protection register | `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D` |

All match the approved SR-01 baseline.

## 8. Warnings and observations

- The Web build retains the pre-existing 521.32 kB main-chunk advisory.
- Android retains the pre-existing Gradle `flatDir` advisory.
- PowerShell blocks `pnpm.ps1`; validations used `pnpm.cmd` without changing
  execution policy.
- The first Android invocation lacked `JAVA_HOME`; the local Android Studio JBR
  was assigned only to the validation process.
- Gradle downloaded its missing wrapper distribution before the successful
  Android validation.
- Pre-existing modified and untracked work outside SR-02 was preserved without
  cleanup, reset or inclusion in this intervention.

## 9. Rollback

Rollback is limited to the type/import boundary:

1. restore the type declarations in `agent-governance.registry.ts`;
2. restore the type import in `monitoring-department.ts` to the registry;
3. remove the neutral contract after its consumers are restored;
4. restore the single known-cycle allowlist in `check-import-cycles.ts`;
5. rerun MC-3A, Web build and Browser regression.

No database, storage, native, production or user-data rollback is required.

## 10. Verdict

**SR-02 PASS — GOVERNANCE IMPORT CYCLE REMOVED**

All SR-02 acceptance criteria are satisfied:

- Web and API graphs report zero cycles;
- governance public type exports are preserved;
- rendered behavior remains unchanged;
- no new runtime dependency was introduced;
- no file was deleted;
- Browser, API and Android gates passed;
- competition material remains unchanged.

Recommendation: close SR-02 independently. Do not begin SR-03 without a new,
explicit mandate limited to the app-shell contract boundary.
