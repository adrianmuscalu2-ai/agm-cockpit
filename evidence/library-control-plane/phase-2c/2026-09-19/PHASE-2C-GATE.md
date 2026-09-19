# Phase 2C gate — OCR, translations, shared archive, cross-surface policy

Date: 2026-09-19
Baseline: `d666ca2927463296287de9cb7c33709681c13a98`
Target branch: `fix/personal-contact-name-first-v150`
Production deploy: not triggered
Push: not performed

## Implemented boundary

- Common policy lives in `@agm/library-control-plane`.
- Persistence classes distinguish `EPHEMERAL_SESSION`, `USER_APPROVED_PERSISTENT`, and `NON_PERSISTENT_SENSITIVE_CONTEXT`.
- Sync classes distinguish `LOCAL_ONLY`, `SYNC_ALLOWED`, and `SYNC_REQUIRED`.
- The shared backend rejects `LOCAL_ONLY`, ephemeral persistence, missing user approval, oversized payloads, binary image data, and credential-like fields before a Prisma write.
- Reads and writes are tenant/owner scoped; revoked and deleted records are excluded from retrieval.
- OCR, previous translations, persistent conversation history, and the general shared archive are resolvers registered under Global Library Authority for BASIC/PREMIUM views.
- Car Mover archive writes remain explicitly reserved for Phase 2D.
- OCR keeps the established local ephemeral store. The explicit archive action synchronizes text-only minimal data when authenticated; image bytes are not uploaded.
- Translator persistence requires the explicit archive command.

## Verification

- `pnpm.cmd --filter @agm/api test:library:phase2c` — PASS, 18/18.
- `pnpm.cmd --filter @agm/api test:library:phase2b` — PASS, 21/21 regression.
- `pnpm.cmd --filter @agm/api build` — PASS.
- `pnpm.cmd --filter @agm/web build` — PASS.
- Web build sub-gates: production API endpoint, PWA release contract, TURN operational UI, TypeScript, speech semantics 12/12, Vite production build — PASS.
- `git diff --check` — PASS.

## Gate matrix

- OCR RESOLVER UNDER GLOBAL AUTHORITY = PASS
- TRANSLATION RESOLVER UNDER GLOBAL AUTHORITY = PASS
- SHARED ARCHIVE BACKEND = PASS
- COMMON STORAGE POLICY = PASS
- EPHEMERAL VS PERSISTENT POLICY = PASS
- USER-APPROVED PERSISTENCE = PASS
- ANDROID → BROWSER SYNC CONTRACT = PASS
- BROWSER → ANDROID SYNC CONTRACT = PASS
- LOCAL-ONLY NEGATIVE CONTROL = PASS
- AUTHORIZATION BEFORE READ/WRITE = PASS
- RESOLVER_CALLED CONTROL = PASS
- NO DIRECT ASSISTANT STORAGE BYPASS = PASS
- GENERIC FALLBACK AFTER ARCHIVE RESOLUTION = PASS
- SHARED ARCHIVE MODULE = IMPLEMENTED

The cross-surface assertions use the same owner-scoped backend service with explicit `ANDROID` and `BROWSER` request surfaces. They are automated integration-contract evidence, not a claim of Phase 3 physical-device validation.
