# APP-004 — OCR Documente — Dosar G0

**ID:** AGM-MOD-APP-004-v1.0  
**Data:** 1 august 2026  
**Prioritate oficială:** 4  
**Stare G0:** PASS

## Scop

Capturarea imaginilor la inițiativa utilizatorului, recunoașterea locală a textului, evaluarea calității, transferul textului editabil către Translator și administrarea istoricului OCR local.

## Responsabilități

- Module Owner: Frontend & Website Owner;
- dezvoltare și mentenanță: OCR/Web maintainer;
- monitorizare: MON-004 / MON-005 / MON-009;
- QA: QA OCR independent;
- Inspector: Architecture Guardian;
- documentație/arhivare: AGM Chronicler / Version Guardian;
- validare finală: Adrian / Product Owner / Turn Commander.

## Continuitate

Sunt protejate: Tesseract local, limbile RO/DE/EN, preprocesarea imaginii, normalizarea Unicode, pragurile de utilizabilitate, controllerul OCR, istoricul local limitat, ștergerea explicită și handoff-ul către Translator. Nu se reconstruiește funcționalitatea existentă.

## Domeniu nou

Se autorizează numai completarea testelor contractuale și a guvernanței. Nu se autorizează cloud OCR, upload de imagini, permisiuni noi, auto-captură, auto-trimitere sau folosirea unui rezultat neconfirmat în decizii de siguranță.
