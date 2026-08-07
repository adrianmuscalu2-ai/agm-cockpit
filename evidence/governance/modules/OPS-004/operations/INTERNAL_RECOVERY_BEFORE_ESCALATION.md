# OPS-004 — Internal Recovery Before Escalation

**Status:** ACTIVE / PRE-SAVE MANDATORY  
**Effective:** 2026-08-07  
**Scope:** incidente tehnice și operaționale AGM

## Regula executabilă

`PROCEDURĂ → AGENT RESPONSABIL → MECANISM DISPONIBIL → EXECUȚIE / RECOVERY → VALIDARE → ESCALADARE NUMAI DACĂ RĂMÂNE UN BLOCAJ REAL`

Turn activează automat rolurile definite în `apps/web/src/incident-routing.registry.ts`. Executorul consumă mecanismele interne autorizate declarate de rută și consemnează numai rezultate sigure.

Escaladarea către Product Owner este interzisă cât timp există un mecanism intern autorizat neîncercat. Poarta executabilă este `assessProductOwnerEscalation`.

## Criterii rezervate Product Owner-ului

- decizie de produs;
- schimbare de scop;
- risc major;
- acțiune ireversibilă;
- conflict de autoritate;
- blocaj tehnic real după epuizarea documentată a mecanismelor interne.

## Validare pre-save

Un incident recuperat intern ajunge direct la Inspector. Următoarea versiune stabilă este permisă numai dacă testele registrului demonstrează că o rută recuperabilă nu solicită prematur intervenția Product Owner-ului.

C2.3 confirmă aplicarea: runtime-ul a fost oprit prin WMI, portul oficial a fost recuperat, API-ul actual a fost pornit și testul funcțional real a trecut.
