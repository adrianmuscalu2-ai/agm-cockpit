# AGM Android Assistant and Gmail presentation — predeploy validation

Date: 2026-09-17 (Europe/Berlin)

## Corrected defects

- Unresolved Android actions now retain `CLARIFICATION_REQUIRED` instead of
  being flattened to the false `UNAVAILABLE` result.
- A Gmail answer in a language different from the active user language is
  translated before user-facing composition. Retrieval facts and the original
  Gmail source trace remain unchanged and separate.
- Translation egress is minimized to the cleaned subject (maximum 180
  characters) and cleaned summary (maximum 420 characters) per message.
  Links, Gmail identifiers, and attachments are excluded. Email addresses,
  telephone numbers, and VINs are masked locally and restored locally.
- OpenAI translation requests explicitly use `store:false`.
- If translation is unavailable, the original answer remains accessible and
  the speech layer selects the detected text language rather than forcing the
  UI language.

## Validation

- Targeted Gmail/translation API regression: 23/23 PASS.
- Full API suite: 77 suites, 467/467 tests PASS.
- API TypeScript/Nest build: PASS.
- Premium Assistant UI regression: 12/12 PASS.
- Android Action Layer protocol: PASS.
- Global semantic speech normalization: 12/12 languages PASS.
- Web Production build: PASS.
- Controlled Browser source-separation audit: PASS.

## Signed Android artifacts

- AAB SHA-256: `D64ADF17E2945A4A9570EF7647668C6BE55D59228777AA8FE35B262404CA6EC3`.
- APKS SHA-256: `3023E134075C9F9AAE0D249D5ADEEA5D2F912EC75AFDF2B5D1C7B684E81191E2`.
- Universal APK SHA-256: `EE07BF64123AAA8B341D909A2F7D0A0DE10F77BD548C17168951601DB2B90C83`.
- DPAPI signing custody: PASS; no secret was printed or persisted as evidence.

Production deployment and the final physical-device validation are deliberately
not marked PASS in this predeploy record. Their receipts are recorded only
after the canonical deployment and current-build phone execution complete.
