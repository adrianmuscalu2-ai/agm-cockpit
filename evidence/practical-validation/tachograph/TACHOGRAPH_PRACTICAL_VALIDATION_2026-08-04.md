# AGM Basic - Validare practică Tahograf

Data: 2026-08-04

## Verdict

**PASS / CLOSED**

## Imagine publică reală

- Fișier: `tachograph-driving-without-card-clear.jpg`
- Sursă: https://talleres-dtcoplus.com/noticias-vdo/error-tacografo/
- Scop: validare internă; fotografia nu este redistribuită ca activ de produs.

## Text OCR și confirmare

- Prima trecere pe fotografia reală: rezultat insuficient.
- A doua trecere OCR pentru afișaj LCD: rezultat nesigur, 46%.
- Textul nesigur a fost afișat utilizatorului pentru corectare.
- Text confirmat de utilizator: `Driving whithout card 28`.
- Analiza a folosit exclusiv textul confirmat.

## Rezultat contextual Android

- Identificare: `Conducere fără card tahograf`.
- Status: `Parțial`, încredere orientativă 50%.
- Explicație: posibilă problemă a cardului; cauza exactă trebuie verificată pe aparat și în instrucțiunile oficiale.
- Acțiuni: compararea textului cu afișajul, verificarea introducerii/valabilității/stării cardului și urmarea procedurii firmei dacă problema persistă.
- Limitare declarată: nu se ia o decizie numai pe baza fotografiei.
- Knowledge păstrat separat.
- Acțiuni disponibile: Traducător, Email, copiere, recaptură.

## Diferențe descoperite și remediate

1. OCR-ul cu o singură trecere nu localiza textul LCD mic.
   - Remediere: trecere suplimentară `SPARSE_TEXT` pe variantă cu contrast ridicat.
2. Textul OCR nesigur era ascuns și nu putea fi corectat.
   - Remediere: textul nesigur rămâne vizibil; analiza necesită confirmare explicită.
3. `driving without card` era clasificat generic drept activitate de conducere.
   - Remediere: regula specifică pentru conducere fără card are prioritate.
4. Forma OCR/umană `whithout` nu era tolerată.
   - Remediere: toleranță strict limitată la variantele `without/whithout`.

## Dovezi

- Captură rezultat Android: `agm-tachograph-pass.png`
- Test analizor: `AGM Basic Sprint 2 tachograph analyzer: PASS`
- Test controller OCR: `SR-07D OCR controller characterization: PASS`
- Build web: PASS
- Build APK Android: PASS
- Instalare Samsung SM-S931B: PASS

