# APP-003 — Protocol de validare utilizator

**Artefact:** `app-debug.apk`  
**SHA-256:** `455aee7571e9a0636253a81e31b474d4cd8e2104ed2a7714809c92d93c524c78`  

## Scenariul 1 — regresie e-mail fără atașamente

1. Creați un draft valid.
2. Verificați preview-ul și confirmați.
3. Confirmați deschiderea clientului e-mail cu destinatar, subiect și corp corecte.
4. Confirmați că utilizatorul păstrează controlul butonului Send.

## Scenariul 2 — e-mail cu atașamente

1. Selectați un document mic și verificați numele/dimensiunea în listă și preview.
2. Eliminați-l, confirmați dispariția, apoi adăugați-l din nou.
3. Confirmați preview-ul și deschideți clientul e-mail.
4. Verificați că documentul este atașat și poate fi deschis.
5. Reveniți în AGM și confirmați că aplicația este responsivă.

## Scenariul 3 — limite și erori

1. Încercați peste 5 fișiere, un fișier peste 10 MiB și un total peste 20 MiB.
2. Confirmați mesajele clare și păstrarea draftului.

## Scenariul 4 — WhatsApp Share

1. Creați un draft și, opțional, adăugați un document.
2. Apăsați WhatsApp Share.
3. Confirmați că apare preview-ul obligatoriu.
4. După confirmare, verificați apariția share sheet-ului.
5. Selectați manual WhatsApp și confirmați că AGM nu a ales destinatarul și nu a trimis automat.

## Verdict solicitat

- `CONFIRMAT / PASS`; sau
- `HOLD` cu scenariul și comportamentul observat; sau
- `NO-GO` pentru pierdere de date, auto-send, fișier inaccesibil ori regresie majoră.

