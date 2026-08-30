# APP IT / ES / SV translation dependency recovery

- Scope: application UI English strings only; no source code, i18n keys, secrets, credentials, personal data, or runtime data.
- Prohibited scope preserved: no website publication, DNS, tunnel, connector, API routing, or Production changes.
- Accepted evidence preserved: website IT/ES/SV implementation remains separate and unpublished.

## Attempts

1. `2026-08-28T00:43+02:00` — Node `fetch` batching to the explicitly authorized `translate.googleapis.com` endpoint.
   - Evidence: generator ended with `HTTP 429` and did not create the final dictionary.
   - Classification: external infrastructure / provider rate limiting; no dependency installation required.
   - Decision: do not repeat unchanged.
2. `2026-08-28T00:46+02:00` — minimal provider probe through system `curl.exe`, payload `Confirm action` only.
   - Evidence: `HTTP/1.1 200 OK`, response `Conferma l'azione`.
   - Result: provider route recovered; failure was specific to the initial request path/rate behavior.
   - Next action: use conservative curl batches, 750 ms pacing, four-attempt backoff, and a local UI-only checkpoint.
3. `2026-08-28T00:47–00:57+02:00` — recovered generator route.
   - Evidence: IT `1051/1051`, ES `1051/1051`, SV `1051/1051` unique UI strings; final file written successfully.
   - Result: `RECOVERED`.
   - Output: `apps/web/src/i18n/final-language-app.dictionary.ts`, reconstructed to the canonical key topology.
4. Strict placeholder validation exposed response-parser truncation at newlines and sentence segmentation.
   - Decision: invalidate the affected cache, protect newlines, concatenate every provider response segment, and regenerate rather than accepting partial strings.
   - Evidence: parser cache version `2`; full app and operational dictionaries regenerated; placeholder mismatches `0`, unresolved tokens `0`.
5. Browser runner recovery.
   - Initial failure: profile “More languages” selector did not persist IT because its listener was accidentally placed inside `registerServiceWorker()` after the Development/Android early return.
   - Correction: listener moved to `bindProfile`; Text Corrector listener moved to `bindTextCorrector`; no feature or layout change.
   - Mock correction: unauthenticated refresh returns controlled `401`, then controlled login grants Premium.
   - Result: controlled Browser matrix `18/18 PASS`.
6. Physical Android evidence recovery.
   - Initial CDP `fullPage` capture timed out; native `adb exec-out screencap` later stalled in the USB driver and lock-screen/hardware-layer captures were not accepted as product evidence.
   - Correction: use controlled physical WebView DOM for language, content and overflow; preserve Browser mobile screenshots for visual evidence.
   - Result: Samsung SM-S931B, Android WebView `9/9 PASS`; discarded native screenshots do not contribute to the verdict.

## Handoff

- `HANDOFF TO ATLAS`: translation dependency recovered.
- Preserved verdicts: no Production, website, infrastructure, or runtime scope was reopened.
- Residual task: none for IT/ES/SV application implementation. Publication remains prohibited until a separate mandate.
