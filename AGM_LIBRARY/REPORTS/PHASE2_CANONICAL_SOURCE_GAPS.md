# Phase 2 — exact canonical source gaps

Status: `NOT STARTED — SEPARATE MANDATE REQUIRED`

The machine-readable gap register is
`canonical-source-gaps.phase2.json`. It contains 15 exact acquisition or
consolidation gaps:

- Tacho: 5;
- Legislation/Safety: 5;
- Routing/Toll and Field: 2;
- Car Mover canonical internal specifications: 2;
- Documents/OCR/Evidence: 1.

Phase 2 must populate issuing body, provenance, canonical URI/path, version,
effective date, jurisdiction, supersession, review, owner, retention, evidence
and checksum. Null values in the register are deliberate missing data, not
defaults.

For Tacho and legislation, primary official sources take priority. Secondary
sources can only be `CONTEXTUAL`. No source may become authoritative or
`CURRENT` without a human domain review.

Phase 2 does not imply runtime integration.
