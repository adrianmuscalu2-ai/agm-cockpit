# Turn Command Center — FAZA V1 Inventory and Validation Matrix

Date: 2026-07-25
Stage: Validation and stabilization, no new functions
Phase: V1 — inventory only
Test execution: not started

## 1. Governance boundary

This phase inventories the existing implementation and defines future tests. It
does not authorize fixes, architecture changes, behavior changes, Email Assistant
changes or roadmap updates.

Any nonconformity follows:

```text
Evidence -> Impact analysis -> Proposal -> Approval -> Remediation -> Retest
```

No Git checkpoint is created in V1.

## 2. Compared checkpoints

| Reference | Identifier | Meaning |
| --- | --- | --- |
| Approved baseline | `agm-cockpit-basic-v1.0.0` / commit `7670640` | AGM Basic reference |
| Current committed state | `c499f6b` | Monitor checkpoint; includes committed Turn extensions |
| Current working tree | uncommitted | Contains pre-existing Turn Operations Center changes |

The working-tree Operations Center is not part of `HEAD` and is therefore recorded
as **uncommitted / unvalidated**, not as an approved baseline function. V1 does not
modify, discard or integrate it.

## 3. Source inventory

| Module | Exact source | Current role | Baseline relation |
| --- | --- | --- | --- |
| Turn data model | `apps/web/src/turn-command-center.ts` | Departments, agents, modules, missions and audit trail | Present in baseline |
| Turn renderer | `apps/web/src/turn-command-center.view.ts` | Main read-only Turn presentation | Present in baseline; extended after baseline |
| Inspector reports | `apps/web/src/inspector-agent.ts` | Status, trend, findings, recommendations and alert history | Present in baseline |
| Agent governance registry | `apps/web/src/agent-governance.registry.ts` | Agent identity, ownership, state and responsibility | Present in baseline; synchronized after baseline |
| Incident journal | `apps/web/src/incident-journal.ts` | Incident lifecycle, severity, history, filters and export | Present in baseline |
| Interaction binding | `apps/web/src/main.ts` | Turn route, journal and catalog bindings | Present in baseline; extended after baseline |
| Turn presentation styles | `apps/web/src/styles.css` | Desktop and narrow-screen layout and statuses | Present in baseline; extended after baseline |
| Localization dictionary | `apps/web/src/i18n/app-i18n.dictionary.ts` | Turn and Inspector labels | Present in baseline; changed after baseline |
| Maintenance department | `apps/web/src/maintenance-department.ts` | Maintenance status and records shown in Turn | Existing integrated module |

Static inventory counts:

- 11 departments;
- 10 operational agents in the Turn model;
- 8 application modules;
- 6 missions;
- 5 accepted/in-progress audit records;
- 17 agent-governance records;
- 20 Inspector reports;
- 20 Inspector alert-history entries;
- 4 incident severity levels;
- 7 incident lifecycle states.

## 4. Existing functional inventory

### 4.1 Baseline functions

1. Administrative access to the `/turn` route.
2. Read-only Turn overview and system version.
3. Department status indicators.
4. Agent status indicators.
5. Application-module status indicators.
6. Mission and audit-trail presentation.
7. Inspector badge on supported departments and agents.
8. Detailed Inspector report:
   - last audit;
   - general state;
   - issues;
   - impact;
   - recommendations;
   - Codex priority;
   - last check;
   - trend.
9. Inspector alert-history presentation.
10. General Inspector aggregate report.
11. Incident journal:
    - create;
    - edit;
    - change state;
    - reopen;
    - filter;
    - relate incidents;
    - persist in local storage;
    - export audit information.
12. Incident severity model:
    `informational`, `minor`, `major`, `critical`.

### 4.2 Committed extensions after the baseline

| Commit | Existing extension |
| --- | --- |
| `c362476` | Platform map and synchronized agent registry |
| `220d29d` | Searchable project catalog |
| `bd603c7` | Organizational map |
| `062b015` | Central alert panel derived from open incidents |

The central alert panel:

- includes incidents not in `validated` or `archived`;
- orders them by `critical > major > minor > informational`;
- displays at most five open incidents;
- links to the incident journal and operating procedure;
- reports normal state when no incident is open.

### 4.3 Uncommitted, unvalidated working-tree surface

The current working tree contains an Operations Center and operating procedure
rendered from:

- `apps/web/src/turn-command-center.view.ts`;
- `apps/web/src/main.ts`;
- `apps/web/src/styles.css`.

Observed behavior in source:

- nine service cards;
- only the API card has a real health URL;
- automatic API check every 30 seconds;
- five-second timeout;
- manual API recheck;
- the other cards are marked as unconfigured unless correlated with an incident.

Operator visual evidence supplied in V2 confirms:

- Turn Command Center is one long page organized into sections, not a collection
  of separate pages;
- all nine Operations Center cards are visible;
- only the `API` card is configured;
- the API `Reverifică` button produces a visible effect and requires a complete
  functional test;
- the `SOP` and `Jurnal` links navigate to sections in the application; they are
  not a local per-card journal;
- the remaining eight cards display `NECONFIGURAT`.

This surface is included in the test inventory to prevent accidental omission, but
its product status remains **uncommitted / unvalidated**. No conclusion about
acceptance is made in V1.

## 5. Baseline comparison — before tests

| Area | Baseline | Current committed state | V1 classification |
| --- | --- | --- | --- |
| Core Turn model | Present | Preserved | Regression test required |
| Inspector reports | Present | Preserved | Regression test required |
| Inspector history | Present | Preserved | Regression test required |
| Incident journal | Present | Preserved; one committed source adjustment | Detailed comparison required |
| Agent registry | Present | Expanded/synchronized | Content and rendering test required |
| Platform map | Absent | Present | Committed extension |
| Project catalog | Absent | Present | Committed extension |
| Organization map | Absent | Present | Committed extension |
| Central alert panel | Absent | Present | Committed extension; full alert validation required |
| Operations Center | Absent | Absent from `HEAD`; present only in working tree | Isolate and validate before any decision |

## 6. Validation matrix

Status values during V2/V3: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`.

| ID | Function | PC criterion | Android criterion | PASS criterion | Initial status |
| --- | --- | --- | --- | --- | --- |
| TCC-01 | Turn access | `/turn` opens after authorized access | Same route is reachable in Android build | No unauthorized exposure; authorized route renders | NOT RUN |
| TCC-02 | Read-only overview | Metrics and system information render | Content fits narrow screen | No unintended operational mutation | NOT RUN |
| TCC-02A | Upper section menu | Every item focuses its matching section without leaving Turn | Same behavior with touch input | All 11 items resolve to real targets on the single Turn page | PC: FAIL; Android: NOT RUN |
| TCC-03 | Department indicators | All 11 entries and states render | Labels and states remain readable | Count and state equal source model | STATIC PASS; UI NOT RUN |
| TCC-04 | Agent indicators | All 10 model agents render | Expandable content is usable | Count, labels and statuses equal source | STATIC PASS; UI NOT RUN |
| TCC-05 | Governance registry | All 17 records render | Details can be expanded | Ownership and status match registry | STATIC PASS; UI NOT RUN |
| TCC-06 | General Inspector | Aggregate counts and latest checks render | Detail remains readable | Totals equal the 20 Inspector reports | STATIC PASS; UI NOT RUN |
| TCC-07 | Inspector details | Badge, issues, impact, priority and trend render | Expand/collapse works | Report maps to the correct owner | STATIC PASS; UI NOT RUN |
| TCC-08 | Inspector history | History entry renders for each report | History remains accessible | No missing or mismatched history item | STATIC PASS; UI NOT RUN |
| TCC-09 | Predictive behavior | Trend and recommendation are displayed as advisory | Same content on Android | No automatic remediation or unsupported action | OBSERVATION; UI NOT RUN |
| TCC-10 | Central alert — empty | Normal state renders with no open incidents | Same state on narrow screen | Zero false open alerts | NOT RUN |
| TCC-11 | Central alert — severity | Open incidents are sorted by severity | Order remains understandable | `critical > major > minor > informational` | NOT RUN |
| TCC-12 | Central alert — deduplication | One card per incident ID | Same on Android | Re-render does not multiply the same incident | NOT RUN |
| TCC-13 | Central alert — navigation | Incident, procedure and journal links resolve | Touch targets work | Each link reaches its declared target | NOT RUN |
| TCC-14 | Incident lifecycle | Create/edit/transition/reopen works | Same supported interactions | State/history update once per action | PURE FUNCTIONS PASS; UI NOT RUN |
| TCC-15 | Incident persistence | Reload preserves journal | Restart/reload preserves journal | Local-storage data is restored intact | SOURCE VERIFIED; UI NOT RUN |
| TCC-16 | Incident filters | Query and categorical filters work | Controls remain usable | Results match all active filters | PURE FUNCTIONS PASS; UI NOT RUN |
| TCC-17 | Incident export | Export contains audit fields | Export can be initiated | Content matches current journal | PURE FUNCTIONS PASS; UI NOT RUN |
| TCC-18 | Project catalog | Search returns matching entries | Search usable on narrow screen | No unrelated entry remains for a precise query | NOT RUN |
| TCC-19 | Platform map | Repository, branch, commit and URL render | Details remain readable | Values match repository evidence | NOT RUN |
| TCC-20 | Organization map | Departments and agents group correctly | Details expand without overflow | Each agent appears under its owner | NOT RUN |
| TCC-21 | Responsive layout | No overlap or clipped controls | No horizontal loss of required controls | Required content remains operable | NOT RUN |
| TCC-22 | Baseline regression | Baseline functions remain present | Baseline Android behavior remains present | No baseline function is removed or altered | SOURCE/BUILD PASS; INTERACTIVE NOT RUN |
| TCC-23 | Operations Center structure | One long Turn page contains exactly nine monitoring cards | Same section remains readable on the narrow screen | Nine distinct cards are visible; no claim that they are separate pages | NOT RUN |
| TCC-23A | Operations Center API card | Automatic result and `Reverifică` are compared with the API response | Button and result remain usable on Android | API is the only configured card; displayed state, timestamp and latency respond to a controlled recheck | NOT RUN |
| TCC-23B | Operations Center navigation | `SOP` and `Jurnal` targets are followed | Touch navigation reaches the same targets | Links reach their declared application sections and are not described as a per-card local journal | NOT RUN |
| TCC-23C | Operations Center unconfigured cards | Eight non-API cards display `NECONFIGURAT` | Same state is visible on Android | Recorded as `NOT CONFIGURED / NOT RUN`; no functional PASS is assigned | NOT RUN |
| TCC-24 | Email isolation | Email Assistant is not exercised or changed | ACTION_SEND is not exercised or changed | No Email Assistant source modification in stage | NOT RUN |

## 7. Evidence register

| Evidence ID | Planned evidence | Source | Status |
| --- | --- | --- | --- |
| EV-V1-001 | Baseline commit resolution | Git tag and commit history | COLLECTED |
| EV-V1-002 | Current committed Turn delta | Git diff baseline to `HEAD` | COLLECTED |
| EV-V1-003 | Current working-tree isolation | Git status and diff | COLLECTED |
| EV-V1-004 | Static module/function inventory | Source inspection | COLLECTED |
| EV-V2-PC-001 | PC route and overview screenshot | Browser test | PENDING |
| EV-V2-PC-002 | PC alerts and Inspector evidence | Browser test | PENDING |
| EV-V2-PC-003 | PC incident lifecycle evidence | Browser test | PENDING |
| EV-V2-PC-004 | Operator visual observation: single-page structure and nine Operations Center cards | Operator Browser observation | COLLECTED |
| EV-V2-PC-005 | API `Reverifică` functional evidence | Browser test | PENDING |
| EV-V2-PC-006 | SOP/Jurnal navigation targets | Browser test | PENDING |
| EV-V2-PC-007 | Operator observation: upper Turn menu does not navigate to selected sections | Operator Browser observation | COLLECTED |
| EV-V2-SRC-001 | Menu anchors compared with rendered section IDs and global hash router | Source inspection | COLLECTED |
| EV-V2-BLD-001 | Current web production build | TypeScript and Vite build | PASS |
| EV-V2-STA-001 | Turn model counts and unique IDs | Isolated TypeScript assertions | PASS |
| EV-V2-STA-002 | Inspector statuses, owners, timestamps and history IDs | Isolated TypeScript assertions | PASS WITH OBSERVATION |
| EV-V2-STA-003 | Incident create/transition/filter/export pure functions | In-memory TypeScript assertions | PASS |
| EV-V2-CMP-001 | Baseline-to-HEAD source comparison | Git diff | COLLECTED |
| EV-V2-SEC-001 | Eleven-section source and rendered-target audit | Turn renderer and exported models | COLLECTED |
| EV-V3-AND-001 | Android route and overview photograph | Physical-device test | PENDING |
| EV-V3-AND-002 | Android alerts and Inspector photograph | Physical-device test | PENDING |
| EV-V3-AND-003 | Android responsive/journal evidence | Physical-device test | PENDING |
| EV-V4-CMP-001 | Before/after comparison | Final report | PENDING |

## 8. V2 environment precheck — 2026-07-25

V2 was opened after explicit Turn authorization. No functional test result is
claimed yet.

| Precheck | Result | Classification |
| --- | --- | --- |
| `http://localhost:5173/turn` | HTTP 200, title `A.G.M. Cockpit` | Transport precheck PASS; not a visual Browser test |
| `http://127.0.0.1:3000/api/v1/health/ready` | HTTP 200 | API prerequisite PASS |
| Controllable Browser session | No browser exposed by the validation environment | BLOCKED |
| Android bridge/device | `adb` is not available | BLOCKED |

Because the required Browser surface and Android device bridge are unavailable,
TCC-01 through TCC-24 remain `NOT RUN`. HTTP availability is not accepted as a
substitute for PC or Android visual/interactive validation.

The later operator Browser observation is accepted only for the visible
single-page structure, the count of cards and their displayed configuration
states. It does not change TCC-23A, TCC-23B or TCC-23C to PASS. In particular,
Operations Center has no functional PASS until the configured API card and its
navigation are tested and compared with the baseline.

No application source, local application data or Email Assistant behavior was
changed during this precheck.

## 9. V2 nonconformity register

### NC-V2-001 — Upper Turn menu navigation

Status: **OBSERVATION / DEFECT CONFIRMED — NO REMEDIATION AUTHORIZED**

Operator evidence:

- the upper menu is visible;
- selecting Dashboard, Organization, Agents, Missions, Alerts, Incidents,
  Registers, Architecture, Modules, Documentation or System does not navigate to
  the selected section;
- all Turn sections remain rendered consecutively on the same long page.

Expected interaction:

- Turn remains a single page;
- selecting a menu item scrolls or focuses its corresponding section;
- no separate page is required for each menu item.

Source evidence:

1. The menu generates `href="#turn-${module}"`.
2. The application has a global `hashchange` listener which treats the fragment as
   an application route, calls `viewFromCurrentRoute()` and rerenders.
3. Fragments such as `turn-dashboard` are not recognized application routes and
   fall through to `home`.
4. Only six menu targets have a matching rendered ID:

   - `turn-dashboard`;
   - `turn-organization`;
   - `turn-agents`;
   - `turn-missions`;
   - `turn-alerts`;
   - `turn-modules`.

5. Five menu targets do not have a matching ID:

   - `turn-incidents` — the rendered ID is `incident-journal`;
   - `turn-registers`;
   - `turn-architecture`;
   - `turn-documentation`;
   - `turn-system`.

Baseline comparison:

- the upper module menu is absent from `agm-cockpit-basic-v1.0.0`;
- it was introduced after the baseline by commit `bd603c7`;
- no baseline function was removed;
- the post-baseline menu implementation is incomplete and conflicts with the
  existing hash router.

Classification:

- **implementation defect** for all menu links because of the hash-router conflict;
- **incomplete implementation** for the five links without rendered targets;
- not evidence that Turn should be split into separate pages.

Impact:

- users cannot use the upper menu as a section index;
- long-page content remains visible and can still be reached by manual scrolling;
- no evidence of data loss, security impact or Email Assistant impact;
- PC validation for menu navigation is `FAIL`;
- Android menu navigation remains `NOT RUN`.

Next governance step:

```text
Evidence complete -> impact analysis complete -> remediation proposal pending ->
explicit approval required
```

No source change or workaround was applied.

### NC-V2-003 — Registers destination absent

Status: **FAIL — NO REMEDIATION AUTHORIZED**

The menu exposes `#turn-registers`, but no `turn-registers` element or dedicated
Registers section is rendered. Registry-like information exists elsewhere, which
does not satisfy the declared destination.

### NC-V2-004 — Documentation destination absent

Status: **FAIL — NO REMEDIATION AUTHORIZED**

The menu exposes `#turn-documentation`, but no `turn-documentation` element or
dedicated documentation/reference section is rendered.

### OBS-V2-002 — Inspector data is advisory and static

Status: **OBSERVATION — NO REMEDIATION REQUESTED**

Static validation confirmed:

- 20 Inspector reports;
- status totals: 12 `ok`, 8 `attention`, 0 `error`;
- 20 history entries with unique IDs and valid timestamps;
- every Inspector owner maps to an existing Turn department or agent;
- `maintenance-quality-evolution` is the only Turn model owner without an entry in
  `inspectorReports`; it is rendered through its separate maintenance module;
- every agent-governance owner maps to an existing department.

The current "predictive" presentation consists of predefined trend,
recommendation, impact and priority fields. The inspected implementation does not
perform runtime prediction, automatic remediation or live Inspector inference.
Therefore TCC-09 is recorded as an advisory/static behavior observation until the
product expectation is clarified. No FAIL is assigned solely for being static.

### V2 interim consolidated status

| Area | Result | Evidence boundary |
| --- | --- | --- |
| Production web build | PASS | TypeScript and Vite build completed |
| Turn model counts and unique IDs | PASS | Static assertions |
| Inspector model integrity | PASS WITH OBSERVATION | Static assertions; predictive data is predefined |
| Incident pure functions | PASS | In-memory create, transition, filter and export |
| Upper menu navigation | FAIL | Operator Browser evidence plus source diagnosis |
| Operations Center API | NOT RUN | Functional Browser evidence still required |
| Eight non-API Operations cards | NOT CONFIGURED / NOT RUN | Operator observation |
| PC visual coverage of remaining sections | PARTIAL | Operator evidence only |
| Android interactive coverage | NOT RUN | No device/ADB evidence |
| Email Assistant isolation | PASS FOR THIS STAGE | No Email Assistant source changed |

The first isolated assertion run stopped because the inventory expected 18
governance records. Runtime import demonstrated the exact value is 17. The
inventory was corrected; the application source was not changed. A second
assertion draft used an obsolete incident test-data shape and stopped before
testing product behavior. After aligning the in-memory fixture with the current
public type, the complete assertion set passed. These two harness corrections are
recorded to avoid misclassifying validation-script errors as product defects.

## 10. Section-by-section validation

The classifications below apply to the section content. The separate upper-menu
navigation result remains `FAIL` under NC-V2-001.

### 10.1 Dashboard — OBSERVATION

Verified from the exported Turn models and render calculations:

- active departments: 7;
- stable modules: 4;
- active missions: 1;
- accepted audits: 5;
- Inspector reports requiring attention: 8.

The models contain unique IDs and the production build passes. A complete visual
comparison of every displayed value on PC and Android is still missing, therefore
the section is not promoted to full PASS.

### 10.2 Organization — PASS

Evidence:

- the organizational map is rendered from `agentGovernanceRegistry`;
- 17 unique governance records are grouped under valid Turn department IDs;
- no registry record references an unknown department;
- roles, responsibilities and statuses are present in every record;
- the organization map is a committed post-baseline extension.

The menu link remains covered separately by NC-V2-001.

### 10.3 Agents — PASS

Evidence:

- 10 unique operational agents exist in the Turn model;
- 17 unique detailed governance records exist;
- every Inspector owner for an agent maps to an existing agent;
- allowed agent states and Inspector statuses pass static validation.

Interactive expand/collapse behavior on Android remains `NOT RUN` and does not
change the data-integrity PASS.

### 10.4 Missions — PASS

Evidence:

- six unique missions are present;
- AG-012 through AG-016 are marked accepted/stable;
- AG-017 is active/in progress;
- five unique audit-trail entries are present;
- mission and audit data remain present relative to the baseline.

### 10.5 Alerts — OBSERVATION

Evidence:

- the central alert panel is a committed post-baseline extension;
- source logic excludes `validated` and `archived` incidents;
- source logic orders open incidents
  `critical > major > minor > informational`;
- at most five alerts are rendered;
- links point toward the incident journal and procedure;
- all 12 seeded historical incidents are validated, so the normal seeded state has
  no open central alert.

Full severity and deduplication behavior still requires a controlled Browser test
with open incidents. No full PASS is assigned.

### 10.6 Incidents — OBSERVATION

Evidence:

- 12 seeded historical incidents are present, all validated;
- create, transition, evidence guard, filter and export functions pass isolated
  in-memory assertions;
- IDs, severity, status, relationships and history are part of the model;
- persistence uses `agm.turn.incident-journal.v1` in local storage.

The actual PC form/filter interaction and Android display remain `NOT RUN`.

### 10.7 Registers — FAIL

Evidence:

- the upper menu declares `#turn-registers`;
- no element with ID `turn-registers` is rendered;
- no dedicated Registers section exists;
- agent registry and incident journal data exist elsewhere on the long page, but
  are not assembled under the declared Registers destination.

Classification: incomplete post-baseline implementation. No remediation applied.

### 10.8 Architecture — OBSERVATION

Evidence:

- a Platform Map card exists and displays repository, branch, commit, source path
  and URL data;
- the card is a committed post-baseline extension;
- the upper menu declares `#turn-architecture`;
- no element with ID `turn-architecture` exists.

Architecture content exists, but its declared navigation destination is missing.

### 10.9 Modules — PASS

Evidence:

- eight unique modules are present;
- four are `stable`, three are `active`, and one is `watch`;
- module IDs and statuses pass static validation;
- `turn-modules` exists as a rendered section target;
- the module model is preserved relative to the baseline.

The global hash-router defect can still prevent menu scrolling and remains tracked
separately.

### 10.10 Documentation — FAIL

Evidence:

- the upper menu declares `#turn-documentation`;
- no element with ID `turn-documentation` is rendered;
- no dedicated Documentation section or document-reference list exists in the Turn
  renderer;
- documentation-related governance records elsewhere do not satisfy the declared
  section destination.

Classification: incomplete post-baseline implementation. No remediation applied.

### 10.11 System — OBSERVATION

Evidence:

- a System card exists;
- it displays application version, build state, backend mode and AI mode;
- the values are presentation/configuration values, not a complete live service
  health report;
- the upper menu declares `#turn-system`;
- the System card has no `turn-system` ID.

System information exists, but navigation and live-service scope are incomplete.

### Consolidated section result

| Section | Result |
| --- | --- |
| Dashboard | OBSERVATION |
| Organization | PASS |
| Agents | PASS |
| Missions | PASS |
| Alerts | OBSERVATION |
| Incidents | OBSERVATION |
| Registers | FAIL |
| Architecture | OBSERVATION |
| Modules | PASS |
| Documentation | FAIL |
| System | OBSERVATION |

No section result authorizes remediation. Interactive PC/Android gaps remain open
where explicitly stated.

## 11. Phase V1 exit rule

V1 is ready for review when:

- the inventory identifies baseline, committed extensions and uncommitted surface;
- every required function has a PASS/FAIL criterion;
- PC and Android evidence slots exist;
- no application source was modified;
- no checkpoint was created.

Test execution starts only after this matrix is presented to Turn.
