# Build 63 reconciliation — 2026-11-23

Scope: read-only source, existing CI evidence, public API and anonymous route observation. No deployment, migration, DNS or credential change performed.

## Source identity

- Tag `v1.9.2-build.63`: `b753dbbb3ed284194bb595f5df701e4344c25aab`.
- Production API: `be662a07e1407dfc48bb051d1dea21992c2922de`, version 1.9.2, build ID `api-44954263990-1`, readiness ready, database available.
- Both commits have tree `37a02ba7d4a86ac0a1773e128c660deb319b89e4`. The production commit is a merge with the tagged commit as its second parent. Their source contents are identical.
- Evidence: `git-identity.txt`, `api-ready.json`.
- AGM v9 remains unidentified; it is not an alias established by this verification.

## Prisma evidence

- Tagged source contains 36 migration.sql files, using timestamp names.
- Existing Production run https://github.com/adrianmuscalu2-ai/agm-cockpit/actions/runs/45227271635 recorded at 2026-11-23T17:25:04Z: target API_DATABASE_URL verified; `_prisma_migrations` present, 36 rows, zero unfinished or rolled-back rows; no names containing 0003 or 0004.
- This is existing evidence, not a new database query in this session. See `migration-evidence.txt`.
- The same workflow later FAILED on shell syntax at line 166; role removal was verified. Migration evidence is preserved separately; the entire workflow is not PASS.
- Matching counts do not prove matching migration names/checksums. Full source/database reconciliation is still unverified.
- Exact source-to-production reconciliation for build 63, 2026-11-23:
  - 36 migration rows are present in Production.
  - The 36 source directories are compared against the Production manifest.
  - 35 exact source names/checksums match Production.
  - One source checksum differs: `20260726031500_add_pre_departure_sync` (source `3d5fbc30...a6d59a8`, Production `4fcd84d9...304c03b4`).
  - Two source migrations are absent from the observed Production manifest: `20261024120000_add_authority_execution_claim` and `20261103184600_bind_universal_mandate_risk_refs`.
  - These differences are evidence for reconciliation, not a claim that deployment or migration remediation has occurred.
  - Read-only database object reconciliation, 2026-11-23T20:46Z:
    - `PreDepartureSession` and `PreDepartureAnswer`: PRESENT.
    - `AuthorityExecutionClaim`: ABSENT.
    - `UniversalMandateLifecycleRecord.riskAssessmentId` and `.protectionSetId`: ABSENT.
    - The checksum mismatch for `20260726031500_add_pre_departure_sync` is consistent with the table objects being present.
    - No migration was applied and no database mutation was performed.
    - Source reconciliation remediation, 2026-11-23T21:59Z:
      - The two missing migrations were added to the canonical migration tree.
      - Prisma schema now defines `AuthorityExecutionClaim` and the two UniversalMandate risk columns.
      - DATA-001 persistence contract updated and verified by 6/6 focused tests.

## Routes

- HTTP 200 on `/copilot.html`, `/contabilitate.html`, `/premium/copilot`, `/car-mover/accounting`, with identical HTML SHA256 `52EF81FC718C3F4A70EFACE7927B565B91654B6A25F034A57257ACD7D66E7EE7`.
- Same application HTML does not establish the displayed module. Browser observations are separately recorded in `browser-report.json` and screenshots.
- Source registers `/premium/copilot` and `/car-mover/accounting`; the HTML aliases have not been established.
- Anonymous observations cannot certify authenticated module functionality.
- Controlled browser retest completed: both HTML URLs render Home, whereas the two canonical routes render the access/login screen in a fresh anonymous session. Legal notice overlays are present; no consent was submitted. No page JavaScript errors were observed. This confirms the HTML URLs are not working aliases for the canonical modules in this observation.
- Browser Plugin Status: PASS; Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE; Browser Session Status: PASS; Target Page Status: PASS for rendering/navigation/capture only.

## Rescue journal

- RESCUE ACTIVATED. Local configuration: PowerShell refused pnpm.ps1 due to execution policy. No dependency missing. Used existing pnpm.cmd; preflight succeeded. No policy change or installation.
- IAB exact selection attempted once; CUA returned `failed to write kernel assets: The system cannot find the path specified`. Classified optional session/runtime limitation. No repeat or installation; proceeded with controlled Playwright/Chromium per runbook.
- First controlled probe timed out waiting for networkidle. Changed only readiness criterion to DOMContentLoaded plus visible body and bounded render wait; reran preflight before the minimal route retest. Persistent network activity is not a reason to classify a rendered page as unavailable.
- Browser report distinguishes plugin, integrated control, session and target status. Route capture PASS is not authenticated product PASS.
- HANDOFF TO ATLAS: preserve source identity and migration observation; remaining work is exact migration name/checksum comparison and authenticated route verification, with explicit HTML alias decision if those URLs are required.
- RECOVERED: controlled runner completed all four route observations after the bounded readiness correction. Screenshots and machine-readable report retained.
