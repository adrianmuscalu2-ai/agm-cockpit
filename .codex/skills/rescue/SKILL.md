---
name: rescue
description: Recover technical blockers before HOLD. Use when Atlas reports NU POT CONTINUA, TOOL UNAVAILABLE, RUNTIME UNAVAILABLE, DEPENDENCY FAILURE, SESSION ATTACHMENT FAILURE, or is about to issue HOLD for a potentially recoverable technical condition. Preserve frozen PASS evidence, exhaust approved recovery paths, execute only the affected minimal retest, journal every attempt, and hand control back to Atlas.
---

# Rescue

Apply the rule: **FAIL PE O CALE ≠ HOLD**.

## Activation

Emit `RESCUE ACTIVATED` when an Atlas blocker matches the skill description.
Load [recovery-matrix.md](references/recovery-matrix.md), inherit the blocker
context, and preserve all accepted PASS verdicts and frozen evidence.

## Mandatory flow

Follow exactly:

`ATLAS BLOCKED → RESCUE ACTIVATED → EVIDENCE COLLECTION → RECOVERY ATTEMPTS → MINIMAL RETEST → RECOVERED | RECOVERY EXHAUSTED → HANDOFF TO ATLAS`

1. Record the exact failure, affected component, current session, last known
   working evidence, and prohibited scope.
2. Search logs, history, processes, configuration, cached state, tool discovery,
   and existing evidence before concluding that a capability does not exist.
3. Classify the cause as product, local configuration, extension, runtime,
   Codex session, external infrastructure, or procedure/governance.
4. Attempt only relevant approved recovery actions in order: retry, reconnect,
   safe component restart, dependency verification, Extension Host verification,
   approved alternate route, approved fallback, and available reprovisioning or
   new session.
5. For each attempt, journal timestamp, action, evidence, result, and next
   decision. Never repeat an unchanged failed action.
6. Run only the smallest test that proves recovery of the affected capability.
7. Return `RECOVERED` only with direct evidence. Return `RECOVERY EXHAUSTED` only
   after every applicable approved route is attempted or proved unavailable.
8. Emit `HANDOFF TO ATLAS` with preserved verdicts, residual risks, and one
   bounded next action.

## Guardrails

- Do not modify product code to mask a missing tool.
- Do not reopen Translator or accepted Android tests.
- Do not modify Cloudflare, DNS, database, Production, or secrets without a
  separate mandate.
- Do not install or uninstall software without explicit authorization.
- Do not convert local validation into Production PASS.
- Honor explicit STOP immediately.
- Do not issue HOLD before `RECOVERY EXHAUSTED`, except for a real critical
  incident.
- Do not ask the Product Owner to repeat a recovery step already evidenced as
  unsuccessful.

## Dependency installation policy

Classify every missing capability before installation:

- `NECESAR`: no compatible component exists and the function cannot operate;
- `DEFECT DE CONFIGURARE`: a compatible component exists but paths or variables
  are wrong;
- `DEFECT DE RUNTIME/SESIUNE`: local installation cannot repair the host;
- `OPȚIONAL`: not required for the current objective.

Install automatically only for `NECESAR`, from a verified official source,
after recording necessity, publisher, version, compatibility, minimal decisive
test, and rollback. Require separate authorization for security, Production,
infrastructure, accounts, licenses, or cost impact. Never install speculative
alternatives.

## Browser session-attachment rule

Run `pnpm rescue:browser-preflight` before every Browser test. Reuse an accepted
Browser PASS when its evidence hashes, canonical URLs, and visual build
signature remain unchanged. Do not repeat Browser PASS daily.

Treat local browser installation, Browser plugin availability, and the live
Integrated Browser/Computer Use session backend as three independent layers.
Never reinstall a local browser to repair a missing `iab` backend. Confirm
recovery only when exact `iab` selection succeeds and the same binding performs
one neutral navigation and capture. Do not start AGM for this probe.

When the active host is VS Code and `iab` is absent, prepare a deterministic
handoff record under `evidence/browser-control/`, preserve the verified local
server if one is already authorized and running, and route the Browser-only
steps to Codex Desktop. Never request another `iab` attempt from the unchanged
VS Code session. Import the Desktop result into the same record without
reopening frozen product scopes.

Use these canonical endpoints only:

- Website: `https://app.agmcockpit.com/`
- Cockpit: `http://127.0.0.1:5174/` (`STRICT PORT`)
- Email: `http://127.0.0.1:5174/email`
- Fitness: `http://127.0.0.1:5173/` (`RESERVED / DO NOT TOUCH`)
