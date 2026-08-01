# APP-006 — Inventar interfețe G0

## Intrări

Text, sourceLanguage, targetLanguage, mod și sourceModule.

## Consumatori

- APP-002 Translator;
- APP-003 Email Assistant/Mailmaster;
- Document Assistant;
- ruta standalone `/corrector`.

## Ieșire

Rezultatul conține text original/corectat, limbi, mod, modul sursă, agentId, confidence și warnings. Corectorul este local și nu transmite textul către API-003.

