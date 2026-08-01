# APP-004 — Arhitectura G1

Incrementul introduce un test contractual APP-004 fără schimbare funcțională.

## Criterii PASS

- normalizarea păstrează Unicode și elimină caracterele de control;
- rezultatele sub prag sau fragmentate nu sunt utilizabile;
- fișierele non-imagine sunt respinse înaintea procesării;
- textul absent, calitatea redusă și eroarea au stări distincte;
- `isOcrProcessing` revine întotdeauna la `false`;
- numai rezultatul utilizabil ajunge în Translator;
- istoricul este limitat la 8 și poate fi șters;
- datele rămân locale;
- regresiile și buildurile Web/Android sunt PASS.

## NO-GO

Upload neautorizat, transfer automat al unui rezultat degradat, pierderea Unicode, istoric peste limită, stare de procesare blocată sau regresie în Translator/runtime.
