# ROUTING-TOLL-001 final evidence rescue journal

Status: `RECOVERED / HANDOFF TO ATLAS`

> Resume closure update - 2026-08-30 13:40 CEST: the Product Owner supplied the
> exact official artifact. The historical `RECOVERY EXHAUSTED` section below is
> retained as the audit trail for the earlier automated-acquisition failure.

## Frozen evidence

- Central Registry remains `831`, SHA-256 `f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d`.
- Routing/Toll view remains `279`, SHA-256 `001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997`.
- France remains `22/22` entities and `26/26` regimes accounted, with zero integrity blockers.
- Four owner-assisted official artifacts remain validated and ingested review-only.
- Ten authority candidates remain integrity-verified and `PENDING_PRODUCT_OWNER_AUTHORITY_REVIEW`; no authority promotion was executed.
- Runtime, Production, TURN, Application, API, Basic Librarian, LEGAL-003 and LEGAL-005 were not reopened.

## Exact blocker

- Component: official documentary acquisition for `RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026`.
- Required artifact: complete 2026 Tunnel Liefkenshoek NV conditions and tariff PDF from `liefkenshoektunnel.be`.
- Failure: automated requests to the official binary are rejected by the official edge with HTTP `403` / Cloudflare challenge.
- Prohibited scope: no unofficial mirror, cache promoted as authority, OCR reconstruction, recreated tariff table, Registry/view mutation, authority promotion, Production change, dependency installation, or repetition of an unchanged failed request.

## Browser fields

- Browser Plugin Status: `PASS`.
- Integrated Browser Control Status: `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE` (`iab` exact selection returned `Browser is not available: iab`).
- Browser Session Status: `PASS` for the preserved controlled AGM Playwright/Chromium evidence.
- Target Page Status: `PARTIAL / OFFICIAL PDF BINARY HTTP 403`; this is an external documentary-acquisition target, not a product Browser regression.

## Recovery attempts

| Time (CEST) | Action | Evidence | Result | Next decision |
|---|---|---|---|---|
| 2026-08-30 13:19 | Ran mandatory `pnpm rescue:browser-preflight`. | PowerShell rejected `pnpm.ps1` under ExecutionPolicy. | `DEFECT DE CONFIGURARE`; no product/dependency failure. | Use the already approved Windows command shim once. |
| 2026-08-30 13:19 | Ran `pnpm.cmd rescue:browser-preflight`. | Preflight generated at `2026-08-30T11:19:27.199Z`; host `VS_CODE`; helper present; session attachment `STALE_OR_NOT_PROVISIONED`. | `PASS`; canonical route selects controlled runner, IAB optional-unavailable. | Probe exact IAB once. |
| 2026-08-30 13:20 | Selected exact `iab` runtime. | Runtime response: `Browser is not available: iab`. | `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`. | Do not retry or install; continue approved fallback. |
| 2026-08-30 13:20 | Selected an available browser for the exact official PDF URL. | Runtime response: `No browser is available`. | No extension-backed browser session attached. | Preserve prior controlled runner evidence; use official-source discovery and one new official URL. |
| 2026-08-30 13:21 | Opened/searched the operator page and Dutch PDF through the web retrieval surface. | Official page content and the 2026 tariff appendix were visible; direct PDF open returned `403`. | Source/content existence confirmed, but no local canonical binary; not promoted to integrity PASS. | Check the separately accepted official English PDF. |
| 2026-08-30 13:22 | Checked for a pre-existing owner download by exact Liefkenshoek filename/scope. | Only `05_LIEFKENSHOEK_2026_CHECKLIST.md` was present; no PDF. | No already-completed owner step to import. | Attempt the official English binary once. |
| 2026-08-30 13:23 | Requested the official English PDF in sandbox. | Connection was blocked locally before HTTP. | Sandbox network limitation; not evidence about the official host. | Repeat once outside sandbox with approval. |
| 2026-08-30 13:23 | Requested the official English PDF outside sandbox with browser headers and official referer. | Official host returned HTTP `403`; no temporary file remained. | External infrastructure/edge restriction confirmed. | Automated official acquisition routes exhausted. |
| 2026-08-30 13:26 | Added artifact-05 validator and made closure generators/tests support both pre- and post-ingestion state. | Syntax checks PASS; final-closure validation `58/58 PASS`; final-blocker validation `46/46 PASS`; both generators idempotent. | Recovery tooling ready; current evidence verdict preserved. | Owner saves one complete official PDF, then Atlas runs only artifact-05 ingestion and affected closure retests. |

## Dependency classification

- Browser/Chromium and the controlled runner already exist: no installation is necessary.
- Missing `iab` is `DEFECT DE RUNTIME/SESIUNE`; installing a browser or plugin cannot provision it.
- Additional PDF rendering packages are `OPTIONAL` for this step because the original official PDF binary plus full-page text extraction and structural checks are sufficient for the prepared validator. No dependency was installed.

## Minimal retest result

- `node scripts/build-routing-toll-001-final-closure.mjs` -> current verdict `BLOCKED`, one evidence blocker.
- `node scripts/test-routing-toll-001-final-closure.mjs` -> `58/58 PASS`, idempotence PASS.
- `node scripts/build-routing-toll-001-final-blocker-resolution.mjs` -> `4 resolved / 1 remaining`.
- `node scripts/test-routing-toll-001-final-blocker-resolution.mjs` -> `46/46 PASS`, idempotence PASS.

## Handoff to Atlas

`RECOVERY EXHAUSTED` for automated acquisition. The single bounded next action is owner-assisted capture of either accepted official PDF into:

`AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/OWNER_MANUAL_INGEST/RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026.owner-official.pdf`

After the file exists, run only:

1. `node scripts/ingest-routing-toll-owner-artifact-05.mjs`
2. `node scripts/build-routing-toll-001-final-closure.mjs`
3. `node scripts/test-routing-toll-001-final-closure.mjs`
4. `node scripts/build-routing-toll-001-final-blocker-resolution.mjs`
5. `node scripts/test-routing-toll-001-final-blocker-resolution.mjs`

Expected post-ingestion documentary state: official evidence `5/5 RESOLVED`, facilities integrity `8/8`, and `READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW`. ROUTING-TOLL-001 must remain open until the ten human authority decisions and the freshness gate are completed.

## Recovery completion - owner artifact received

| Time (CEST) | Action | Evidence | Result |
|---|---|---|---|
| 2026-08-30 13:31 | Located the supplied PDF in `OWNER_MANUAL_INGEST`. | Received name was `RT001-FINAL-BE-LIEFKENSHOEK-2026.owner-official.pdf`, 429035 bytes. | Artifact present; only the required `FAC` token was missing from the filename. |
| 2026-08-30 13:33 | Normalized the filename inside the same folder. | SHA-256 before and after rename: `2a8d05846ba96759c777ee6a9211474a8b61fcf6efd0123339010c1eecba3435`. | Binary identity preserved. |
| 2026-08-30 13:34 | Ran Browser preflight before controlled visual attempts. | Browser Plugin `PASS`; IAB remains optional platform limitation; controlled runner required. | Frozen Browser evidence preserved; no AGM target retest. |
| 2026-08-30 13:35 | Attempted local PDF rendering with Playwright Chromium and then Edge headless. | Chromium treated the PDF as a download; Edge renderer failed during GPU initialization. | Renderer runtime limitation; PDF validity not affected; no sandbox relaxation or dependency installation. |
| 2026-08-30 13:37 | Ran normal and clip-aware Xpdf extraction on the original binary. | Both modes returned 10/10 pages with identical per-page content; all pages nonempty; no Cloudflare, access-denied or 403 content. | Complete capture/no page-content loss proved through the available compatible runtime. |
| 2026-08-30 13:41 | Ran artifact-05 ingestion validator. | `19/19 PASS`, 10 pages, 12/12 articles, exact category/payment/tariff markers, effective date `2026-01-01`, official host `www.liefkenshoektunnel.be`; the source's legacy early-page `V2024` footer labels are preserved and recorded alongside the controlling 2026 markers. | Artifact `VALID`; manifest `23 captured / 0 blocked`. |
| 2026-08-30 13:40 | Rebuilt and reran only affected closure/blocker validators. | Closure `59/59 PASS`; blocker `46/46 PASS`; both idempotent. | Official evidence `5/5`; Facilities `8/8`; zero evidence blockers. |

## Final handoff

- Recovery result: `RECOVERED`.
- Final documentary verdict: `READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW`.
- Routing state: `OPEN_READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW`.
- Product Owner package: 10/10 integrity-verified candidates, 10 `PENDING`, 0 approved, 0 rejected.
- Authority promotions: 0.
- Registry/view mutations: none; canonical counts and SHA-256 baselines unchanged.
- Commit/push: not executed.

`HANDOFF TO ATLAS` - the next bounded action is the ten Product Owner authority decisions. Closure remains forbidden until those decisions and the freshness gate are completed.
