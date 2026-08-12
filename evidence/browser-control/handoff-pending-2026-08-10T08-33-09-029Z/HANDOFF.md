# Rescue Browser handoff

Created: 2026-08-10T08:33:09.033Z

Route: VS CODE BLOCKED → RESCUE → CODEX DESKTOP iab → PROBĂ MINIMĂ → HANDOFF → ÎNCHIDERE

- Website: https://app.agmcockpit.com/
- Cockpit: http://127.0.0.1:5174/
- Email: http://127.0.0.1:5174/email
- Fitness: http://127.0.0.1:5173/ — RESERVED / DO NOT TOUCH
- Visual signature: F7C3ECE1C4EC36934780DCD186B89EB52B3732C3AB8011398D29715F235F3AAE
- AGM PRODUCT: PASS / FROZEN

Desktop: select exact iab, open the three validation URLs, perform minimal navigation and captures, then complete this file. Do not run Translator, Android, API, Production, or a full AGM retest.

## Scoped continuation — Premium Slice A only

This handoff resumes `evidence/slice-a/EVIDENCE_MANIFEST.json`; it does not
reset that manifest. Preserve every existing PASS and execute only the pending
Desktop atomic probes on the current visual signature:

- required document present/readable/valid → user-confirmed READY;
- required document missing → BLOCKED;
- unreadable document → issue/remediation;
- edited OCR → human confirmation with provenance preserved;
- missing/corrupt IndexedDB original → RECOVERY_REQUIRED;
- refresh/restart resume and language change without operational-state loss;
- feature flag rollback restores the legacy projection;
- rendered status/layout check in RO/DE/EN/FR/NL/RU/PL/TR/SQ.

Use `http://127.0.0.1:5174/premium/before-departure`. Record each atomic
result and capture independently. An interrupted probe alone remains PENDING;
completed probes remain PASS. Do not start Slice B or any of the other 22
situations. Physical Android validation remains a separate pending gate.
