# Browser Validation Governance Amendment

**Authority:** Product Owner  
**Effective:** 2026-08-11  
**Status:** APPROVED / ACTIVE

## Previous rule

Integrated Browser `iab` was a mandatory independent gate. Its absence stopped
product Browser validation even when controlled Playwright/Chromium evidence
was available.

## Reason for amendment

`iab` provisioning is session-host controlled and is not persistent across
Codex Desktop restarts or handoffs. AGM cannot provision that external backend.
The recurring absence is therefore a platform limitation, not an AGM Cockpit
failure.

## New rule

Controlled AGM Playwright/Chromium PASS is official and sufficient Browser
release evidence. `iab` is probed once and becomes optional interactive
evidence. If absent it is recorded as `PLATFORM LIMITATION / OPTIONAL EVIDENCE
UNAVAILABLE` and cannot block the product.

The runner must use real Chromium, exercise the real target and required
interactions, validate UI state, and preserve screenshots, logs, timestamps,
URL, build/revision context, and machine-readable PASS/FAIL per scenario. It
must never promote an unexecuted scenario to PASS.

## Scope of authority

This amendment changes the validation mechanism, not the validation standard.
It does not authorize product changes, Android repetition, Slice B, Production,
Basic, or Fitness changes.
