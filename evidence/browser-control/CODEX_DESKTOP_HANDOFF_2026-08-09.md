# Codex Desktop Integrated Browser handoff — 2026-08-09

## Source and frozen scope

- Source executor: Atlas in VS Code extension `26.803.41515`.
- Destination executor: Codex Desktop with exact `iab` backend.
- `AGM PRODUCT — PASS / FROZEN`.
- `RESCUE PILOT — PASS`.
- `VS CODE RECOVERY — EXHAUSTED`.
- No Translator, Android, API translation, Production, DNS, Cloudflare, or
  database testing is authorized.

## Prepared targets

| Surface | URL | Prepared status |
|---|---|---|
| Public AGM website | `https://agm-cockpit.pages.dev/` | URL established from AGM evidence registry |
| AGM Cockpit local main | `http://127.0.0.1:5174/` | HTTP 200 |
| AGM Cockpit local route | `http://127.0.0.1:5174/email` | browser navigation pending |

Cockpit listener: PID `12224`, Vite `5.4.21`, project `@agm/web`, explicit
`--host 127.0.0.1 --port 5174 --strictPort`.

Port `5173` is reserved for AGM Fitness. The Product Owner confirms the Fitness
UI is running visibly and its implementation server reloads periodically. A
point-in-time check and a later 30-second OS sampling window did not observe a
TCP row; those missed snapshots do not override the live operator evidence and
must not be interpreted as a free port. No process on `5173` was stopped,
restarted, modified, or reused. Cockpit remains isolated on `5174`.

## Desktop-only instructions

1. Select exact backend `iab`. Stop and record session blocker if unavailable.
2. Open `https://agm-cockpit.pages.dev/`, inspect the rendered main page, and
   save one capture.
3. Read-only check that any process currently on `5173` remains untouched.
4. Open `http://127.0.0.1:5174/`, inspect the rendered main page, and save one
   capture.
5. Navigate in the same binding to `http://127.0.0.1:5174/email`; confirm the
   route renders and save one capture.
6. Record exact URLs, capture identifiers, Desktop session/build, `iab` result,
   port results, and timestamp in this file or a sibling result file.
7. Do not execute any Translator, Android, Production, or full regression test.

## Acceptance record

Handoff attempt:

- `codex app C:\Users\adria\Documents\AGM` completed successfully and opened
  the AGM workspace in Codex Desktop.
- One post-launch selector probe from the originating VS Code conversation still
  returned `Browser is not available: iab`.
- This result does **not** prove that Desktop itself lacks `iab`; it proves that
  launching Desktop does not migrate or export its backend into the existing VS
  Code conversation.
- The Desktop Browser executor must consume this handoff inside its own Desktop
  conversation. The originating VS Code executor cannot impersonate that
  session or record Desktop captures.
- During the follow-up, Browser/plugin/runtime updated to `26.803.41515` and the
  new Computer Use named pipe became present. The browser-control executor still
  failed before selection with `windows sandbox failed: CreateProcessWithLogonW
  failed: 2`. Therefore no `iab` navigation or capture was fabricated.

Current results:

- `PUBLIC AGM WEBSITE — OPEN / PASS`
- `AGM COCKPIT LOCAL — OPEN / PASS`
- `AGM FITNESS :5173 — RESERVED / OPERATOR-CONFIRMED RUNNING / UNTOUCHED`
- `INTEGRATED BROWSER HANDOFF — PASS`

No further `iab` retry is permitted from this unchanged VS Code conversation.

## Imported Desktop result

Source: `integrated-browser-handoff-2026-08-09/HANDOFF.md`.

- Codex Desktop exact `iab` selection: PASS.
- Browser ID: `-74ce-4213-b878-c704ec04a1b9`.
- `https://app.agmcockpit.com/`: rendered and captured.
- `http://127.0.0.1:5174/`: rendered, DOM inspectable, AGM Cockpit 1.3.0.
- `http://127.0.0.1:5174/email`: exact URL confirmed, `POC 02` rendered,
  captured.
- Local navigation timeout behavior: observed after render; classified as
  Browser session timing, not a product defect.
- Fitness `5173`, Cloudflare, DNS, Production, Translator, Android, and API:
  untouched.

Imported verdicts:

- `INTEGRATED BROWSER CONTROL — PASS`
- `BROWSER VISUAL VALIDATION — PASS`
- `RESCUE PILOT — PASS`
- `AGM PRODUCT — PASS / FROZEN`
