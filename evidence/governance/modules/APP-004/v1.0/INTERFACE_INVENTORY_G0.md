# APP-004 — Inventar interfețe G0

| Interfață | Contract |
|---|---|
| utilizator → selector/cameră | captură explicită `image/*` |
| OCR → Tesseract.js | procesare locală RO/DE/EN |
| OCR → APP-002 Translator | numai text editabil utilizabil |
| OCR → APP-009 Storage | istoric local `agm.ocr.history.v1`, maximum 8 |
| OCR → APP-015/OPS-002 | camera și runtime Android aprobate |
| OCR → APP-003 | text/document candidat, fără trimitere automată |
| OCR → PRE-007 | valori utilizabile numai după confirmare umană |
