# AGM Basic - Validare practică Legislație

Data: 2026-08-04

## Verdict

**PASS / CLOSED**

## Imagine publică

- Fișier: `break-and-driving-limits.webp`
- Sursă: https://bcs-bus.com/blog/bcs-news/eu-driving-rules-for-professional-drivers
- Conținut vizibil: `4,5 hrs` și `45 mins` într-o schemă conducere/pauză.
- Utilizare: validare internă; imaginea nu este activ de produs.

## OCR și confirmare

- OCR Android pe imaginea reală: `4,5 hrs 45 mins`.
- Încredere OCR: 95%.
- Retestare după remediere cu text confirmat: `4.5 hrs 45 min`.
- Analiza a folosit exclusiv textul confirmat de utilizator.

## Rezultat contextual Android

- Temă: `Pauză după conducere`.
- Status: `Identificat`.
- Valori identificate: `4.5 hrs`, `45 min`.
- Explicație: regula generală publicată privind pauza după cel mult 4h30; explicația Knowledge este separată de faptele OCR.
- Acțiuni: compararea valorilor cu activitățile complete și verificarea ordinii/continuității pauzelor.
- Avertizare: rezultatul este orientativ și nu reprezintă decizie juridică sau calcul complet de conformitate.
- Acțiuni disponibile: Traducător, Email, copiere și recaptură.

## Diferență descoperită și remediată

- Extractorul nu păstra notația zecimală `4,5 hrs` și pluralul `mins` în secțiunea faptelor.
- Remediere: suport pentru notațiile `4,5`, `4.5`, `4:30`, `hrs`, `min` și `mins`.
- Regresie adăugată pe textul real al imaginii.

## Dovezi

- Captură Android: `agm-legislation-pass.png`
- Test analizor Legislație: PASS
- Build web: PASS
- Build APK Android: PASS
- Instalare Samsung SM-S931B: PASS

