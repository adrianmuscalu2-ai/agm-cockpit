# AGM Basic - Validare practică mesaj textual din bord

Data: 2026-08-04

## Verdict

**PASS / CLOSED**

## Imagine publică reală

- Fișier: `braking-system-fault.webp`
- Sursă: https://sinceremechanic.com/braking-system-fault/
- Mesaj vizibil: `STOP` / `Braking system fault`.
- Utilizare: validare internă; imaginea nu este activ de produs.

## OCR și confirmare

- OCR inițial: rezultat fragmentat, 40%.
- Filtrul de calitate a fost corectat pentru rezultate scurte și fragmentate.
- Rezultatul nesigur a rămas vizibil pentru corectare.
- Text confirmat de utilizator: `STOP` / `Bracking system fault`.
- Analiza a folosit exclusiv textul confirmat.

## Rezultat contextual Android

- Identificare: `Mesaj STOP - sistem de frânare`.
- Status: `Identificat`.
- Instrucțiune explicită: `STOP`.
- Explicație: textul indică o defecțiune a sistemului de frânare, fără identificarea unei piese defecte.
- Acțiuni: oprire într-un loc sigur, verificarea mesajului complet și a procedurii vehiculului, solicitarea asistenței dacă mesajul persistă sau frânarea este anormală.
- Limitări și Knowledge: afișate separat.
- Acțiuni disponibile: Traducător, Email, copiere și recaptură.

## Diferențe descoperite și remediate

1. Zgomotul OCR scurt era acceptat la exact 40%.
   - Remediere: pragul de 40% este nesigur și fragmentele scurte sunt respinse.
2. Regula STOP generică elimina contextul explicit al frânării.
   - Remediere: regulă compusă prioritară STOP + sistem de frânare.
3. Variația `Bracking` din textul confirmat nu era recunoscută.
   - Remediere: toleranță limitată la `brake`, `braking` și `bracking` în contextul mesajului de frânare.

## Dovezi

- Captură Android: `agm-dashboard-text-pass.png`
- Test analizor Sprint 3: PASS
- Contract OCR APP-004: PASS
- Build web: PASS
- Build APK Android: PASS
- Instalare Samsung SM-S931B: PASS

