# P0 Website / Premium / SR-14 reconciliation

Date: 2026-08-09

## Scope and result

Presentation-only P0 reconciliation completed. No Basic, Android, API,
Production, Cloudflare, DNS, database, EventStore, sync/recovery or new Premium
functionality was changed.

## Canonical surfaces

| Surface | Canonical location | Contract |
| --- | --- | --- |
| Presentation website | `http://127.0.0.1:4321/` locally | Separate public route prepared; public URL not invented and not deployed |
| AGM Cockpit | `http://127.0.0.1:5174/` locally; `https://app.agmcockpit.com/` public | `5174 / STRICT PORT` |
| Cockpit Premium CTA | `https://app.agmcockpit.com/access` | Validated Access gateway; entitlement remains authoritative |
| AGM Fitness | `http://127.0.0.1:5173/` | `RESERVED / DO NOT TOUCH`; never a website CTA |

The website build is the static Astro output in `agmcockpit-website/dist` (27
pages). Composite SHA-256 of the sorted per-file SHA-256 manifest:
`8D30AFEB2F150367A9EA790A03363F521DEE5F761816B3B0A80C58F02FEA2DA9`.

No public website deployment was authorized. The website source directory is a
separate, intentionally ignored workspace in the parent AGM repository; its
guardian registry records the route as pending separate deployment authority.

## Reconciliation performed

- replaced Premium's Hub A/B/C presentation with one shared HUB-00–HUB-07
  model;
- made Romanian, German and English pages share the same component, topology,
  stages and CTA semantics;
- retained honest states (`validated foundation`, `partial`, `planned`) and did
  not present planned modules as implemented;
- moved current identity to `1.3.0`, retaining `1.2.9` only as history;
- removed all website links to port 5173 and routed the sole Premium application
  CTA to the Access gateway;
- documented Website/Cockpit/Fitness as three distinct surfaces;
- reconciled the SR-14 expected cascade hash to the approved successor cascade.
  The remaining OCR assertion was made tolerant of the approved thematic class
  while continuing to require `ocr-page` and `aria-labelledby`.

## Executed evidence

| Check | Result |
| --- | --- |
| `agmcockpit-website: pnpm.cmd build` | PASS — 27 static pages |
| `agmcockpit-website: pnpm.cmd test:p0` | PASS |
| generated `dist` href scan for localhost/127.0.0.1 port 5173 | ZERO matches |
| source href scan for localhost/127.0.0.1 port 5173 | ZERO matches |
| `apps/web` SR-14 CSS/i18n/accessibility smoke | PASS |
| Premium foundation tests | PASS |
| Premium operational-context canonical tests | PASS |
| `git diff --check` | PASS (line-ending notices only) |

Mandatory Browser preflight completed at `2026-08-09T06:59:30.719Z`:

- Browser Plugin Status — PASS (runtime/helper present);
- Integrated Browser Control Status — ROUTED / unavailable in current VS Code host;
- Browser Session Status — not started in VS Code;
- Target Page Status — not revalidated visually;
- existing Browser PASS evidence was detected but is not reusable because the
  visual signature changed.

Accordingly, this checkpoint claims source/build/contract validation only and
does not manufacture a new visual PASS. The preflight invoked the established
Codex Desktop handoff route; no browser, plugin or dependency was installed.

Read-only port sampling found Cockpit listening on `127.0.0.1:5174` (PID
12224). Port 5173 had no listener at that exact sample. No process on either
port was started, stopped, restarted or reconfigured during P0; the Fitness
reservation and workspace were untouched.

## Frozen verdicts

- P0 WEBSITE RECONCILIATION — PASS
- WEBSITE 5173 LINKS — ZERO
- FITNESS :5173 — PRESERVED / DO NOT TOUCH CONTRACT
- COCKPIT :5174 — PRESERVED / STRICT PORT
- PREMIUM HUB ARCHITECTURE — ALIGNED
- RO / DE / EN PREMIUM PRESENTATION — ALIGNED
- SR-14 BASELINE — PASS
- BASIC FIELD-TEST FREEZE — PRESERVED
- NO PRODUCT OR PRODUCTION CHANGE

Execution stops at P0. P1 is not authorized or started.
