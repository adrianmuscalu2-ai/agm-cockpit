# OPS-003 — Monitoring & Operations Health — Dosar G0

**ID:** AGM-MOD-OPS-003-v1.0  
**Data:** 1 august 2026  
**Prioritate oficială:** 6  
**Stare G0:** PASS

## Scop

Furnizarea unei imagini operaționale coerente pentru serviciile AGM, corelarea MON-001…MON-012 cu sursele health și incidentele și emiterea alertelor/recovery fără intervenții automate neautorizate.

## Responsabilități

- Module Owner: Chief Monitoring Inspector;
- dezvoltare și mentenanță: Monitoring & Operations;
- monitorizare: MON-001…MON-012;
- QA: QA Operations independent;
- Inspector: Chief Inspector / Turn review;
- documentație/arhivare: AGM Chronicler / Version Guardian;
- validare finală: Adrian / Product Owner / Turn Commander.

## Baseline protejat

- registrul celor 12 agenți MON;
- panoul Turn cu polling la 30 secunde;
- health live/ready și dependențe AI/DB;
- Browser și Cloudflare public;
- monitorul Windows cu prag de două eșecuri, alertă deduplicată și recovery;
- UI LIVE și Incident Journal;
- separarea explicită dintre Android operațional și telemetria neimplementată.

## Limită

Nu se autorizează restart automat, auto-remediere, acces la secrete, colectare de conținut sensibil sau implementarea telemetriei continue OPS-005.
