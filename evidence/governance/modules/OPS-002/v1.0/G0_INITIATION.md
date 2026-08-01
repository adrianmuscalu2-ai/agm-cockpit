# OPS-002 — Android/APK Runtime — Dosar G0

**ID dosar:** AGM-MOD-OPS-002-v1.0  
**Data:** 1 august 2026  
**Prioritate:** 3 în ordinea oficială  
**Stare G0:** PASS

## Obiectiv

Guvernarea runtime-ului Android/Capacitor care împachetează AGM Cockpit, înregistrează pluginurile native și controlează configurația, permisiunile și suprafețele exportate ale APK-ului.

## Responsabilități

- Module Owner: Frontend & Website Owner;
- dezvoltare: Android Runtime maintainer;
- monitorizare: MON-005 / MON-009 / MON-012;
- mentenanță: Android Runtime maintainer;
- QA: QA Android independent;
- Inspector: Architecture Guardian;
- documentație/arhivare: AGM Chronicler / Version Guardian;
- validare finală: Adrian / Product Owner / Turn Commander.

## Continuitate protejată

- aplicația Android fizică și navigarea au fost validate;
- buildul Gradle `assembleDebug` este PASS;
- APP-003 și APP-015 sunt PASS/CLOSED și consumă acest runtime;
- pluginurile Audio, Email și Diagnostics sunt înregistrate și funcționale;
- implementarea existentă nu se reconstruiește.

## Limită de domeniu

Acest increment autorizează inventarierea și un contract automat de runtime/APK. Nu autorizează schimbări de UX, permisiuni noi, identificator nou, semnare de producție, publicare sau distribuție. Semnarea, deployment-ul și rollback-ul aparțin OPS-004.
