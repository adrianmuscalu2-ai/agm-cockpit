# API-006 — Incidents, Evidence & Validation Reports — Dosar G0

**ID:** AGM-MOD-API-006-v1.0  
**Data:** 1 august 2026  
**Stare G0:** PASS

## Scop

Asigurarea trasabilității operaționale între incidente, metadatele dovezilor, rapoartele de validare și audit, cu izolare strictă pe companie și corelare prin request/correlation identifiers.

## Responsabilități

- Module Owner: Turn Operations;
- dezvoltare și mentenanță: API Operations / Data Integrity;
- monitorizare: MON-003 / MON-010 / MON-012;
- QA: API Operations QA independent;
- Inspector: Chief Inspector / Data Architecture;
- documentație și arhivare: AGM Chronicler / Version Guardian;
- validare finală: Adrian / Product Owner / Turn Commander.

## Baseline protejat

- endpointurile Incidents și Evidence;
- serviciul intern Validation Reports;
- autentificarea JWT și izolarea `companyId`;
- tranzacțiile Prisma incident–audit și evidence–audit;
- schema și migrațiile PostgreSQL existente;
- integrarea APP-010, APP-011 și transporturile.

## Limită

Nu sunt autorizate endpointuri noi, modificări de schemă, upload de fișiere, autovalidarea incidentelor, ștergerea dovezilor, migrații sau mutații Production.

