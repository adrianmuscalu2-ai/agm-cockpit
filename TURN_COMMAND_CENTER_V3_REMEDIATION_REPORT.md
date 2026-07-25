# Turn Command Center — V3 Remediation Report

Date: 2026-07-25
Status: IN PROGRESS
Checkpoint: not created

## NC-V2-001 — Upper navigation

### Before

- menu links used generic `#turn-*` fragments;
- the global `hashchange` router interpreted section fragments as application
  routes and rerendered away from the intended section;
- Incidents pointed to `turn-incidents`, while the real ID was
  `incident-journal`;
- Architecture and System content existed without their declared IDs.

### Approved remediation applied

- Turn section fragments are excluded from application-route resolution;
- section hash changes no longer trigger a Turn rerender;
- menu labels are mapped explicitly to their real target IDs;
- Incidents maps to `incident-journal`;
- Architecture content has ID `turn-architecture`;
- System content has ID `turn-system`;
- Registers and Documentation remain mapped but are not implemented in this
  remediation; they belong to NC-V2-003 and NC-V2-004.

Files changed:

- `apps/web/src/main.ts`;
- `apps/web/src/turn-command-center.view.ts`.

### Automated evidence

```text
@agm/web production build: PASS
Production API endpoint validation: PASS
TypeScript: PASS
Vite build: PASS
```

### Interactive retest

Status: **PASS — operator Browser validation**

Turn confirmed that menu navigation reaches the Turn sections and that the user
remains inside Turn Command Center.

Required PC retest:

1. refresh `http://localhost:5173/turn`;
2. click Dashboard, Organization, Agents, Missions, Alerts, Incidents,
   Architecture, Modules and System;
3. confirm the page remains on `/turn`;
4. confirm each click moves/focuses the corresponding section;
5. confirm browser Back/Forward does not leave Turn unexpectedly.

Registers and Documentation were excluded from this retest because their dedicated
remediations had not started.

### Governance confirmation

- no Email Assistant or ACTION_SEND file changed;
- no architecture change outside navigation remediation;
- NC-V2-003 and NC-V2-004 not started;
- no Git checkpoint created.

## Proposed operational extensions received after NC-V2-001

The following requirements were received after the navigation PASS:

- mandatory incident flow from detection through archival;
- explicit operational roles and ownership;
- unique alert IDs and evidence-linked status history;
- stale-data detection and automatic warning;
- bidirectional operational information flow;
- a `Înapoi sus` control.

These items are recorded as **future functional proposals**. They are not part of
NC-V2-001, NC-V2-003 or NC-V2-004 and are not implemented in V3 without a separate
impact analysis and explicit authorization.

## NC-V2-003 — Registers

### Before

- the upper menu declared a `Registers` destination;
- no element with ID `turn-registers` existed;
- the existing agent, incident, Inspector alert-history and mission records were
  displayed only in their individual sections, without a register index.

### Approved remediation applied

- added the missing read-only section `turn-registers`;
- the section indexes only records already present in Turn Command Center;
- added links to the existing Agents, Incidents, Alerts and Missions sections;
- no persistence model, operational status or record content was changed.

File changed:

- `apps/web/src/turn-command-center.view.ts`.

### Automated evidence

```text
git diff --check: PASS (line-ending notices only)
@agm/web production build: PASS
Production API endpoint validation: PASS
TypeScript: PASS
Vite build: PASS
```

### Interactive retest

Status: **AWAITING OPERATOR BROWSER VALIDATION**

Required PC retest:

1. refresh `http://localhost:5173/turn`;
2. click `Registers`;
3. confirm navigation reaches `Registre operaționale` and remains on `/turn`;
4. confirm the four read-only entries are visible: Agents, Incidents, Inspector
   alert history and Missions;
5. activate each `Deschide` link and confirm it reaches the corresponding
   existing section.

NC-V2-004 has not started. No Git checkpoint was created.
