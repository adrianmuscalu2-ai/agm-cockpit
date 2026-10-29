# Dashboard Warning Lights 0.2.0 — provenance closure

## Authoritative replacement

The invalid MAN locator was replaced by the current official MAN document:

`https://public.man.eu/media/service/asp/media/en/899275.pdf?filename=Breakdown+assistance%2C+recovery%2C+towing+TG3`

- downloaded size: 18,554,109 bytes
- SHA-256: `C5651D8E74A29F26AE25A8F86DA7D78518F3DC506EC10C28A1037497E1CD36DF`
- official domain: `public.man.eu`

Validated locators:

- WL-011: p.190, supply pressure too low / C3 supply pressure too low.
- WL-012: p.239, ACC off / ABS unavailable / trailer ABS causes and driver action.
- WL-014: p.237, air suspension driving height not reached.
- WL-013 remains sourced from the official Scania Driver’s Manual portal for AEB camera/radar visibility limitations.

## Selective port

- Canonical 0.1.3 and its 11 verified visual assets remain intact.
- Version advanced to 0.2.0.
- WL-011…WL-014 were added as text-only operational advisories.
- No visual asset, symbol or icon was invented.
- “Verifică”, “Evită”, immediate action, vehicle variation and official source UI are preserved through the current generic knowledge renderer.
- No API contract or current dashboard-analysis implementation was replaced.

## Validation

- legal knowledge publication gate: PASS, 15 entries.
- Web TypeScript: PASS.
- Web production build: PASS.
- static Dashboard camera/OCR containment contract: PASS.
- controlled Browser: PASS on desktop and Android viewport, 15 entries, WL-011…014 actions and sources visible, zero unapproved images, zero page errors.
- Browser evidence: `evidence/phase3/dashboard-warning-lights/2026-09-27T08-49-37-907Z/browser/`.

The older `validate-dashboard-warning-clean-containment-browser.mjs` expects the knowledge-only BASIC card while the current Production build flag enables dashboard vision. Its `KNOWLEDGE_CARD_MISSING` result is a pre-existing test-contract skew and is not used as a false PASS. The new validator checks the actual 0.2.0 catalog contract directly.

Verdict: **DASHBOARD WARNING LIGHTS 0.2.0 — READY AS LOCAL SELECTIVE CANDIDATE**.
