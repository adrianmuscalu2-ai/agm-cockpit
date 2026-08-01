# API-007 — Turn Admin — Dosar G0

**ID:** AGM-MOD-API-007-v1.0  
**Data:** 1 august 2026  
**Stare G0:** PASS

## Scop

Protejarea accesului administrativ Turn prin credential bcrypt, sesiune JWT cu scope dedicat, limitarea tentativelor și audit sigur al rezultatelor de securitate.

## Responsabilități

- Module Owner: Security Governance Owner;
- dezvoltare și mentenanță: API / Security Engineering;
- monitorizare: MON-003 / MON-010 / MON-012;
- QA: API Security QA independent;
- Inspector: Chief Inspector / Security Architecture;
- documentație și arhivare: AGM Chronicler / Version Guardian;
- validare finală: Adrian / Product Owner / Turn Commander.

## Baseline protejat

- endpointurile `unlock`, `validate` și `change-pin`;
- credentialul persistent și hash-ul bcrypt;
- blocarea după cinci tentative pentru 15 minute;
- throttling-ul HTTP al endpointului sensibil;
- sesiunea administrativă de 15 minute;
- integrarea APP-011 și fluxurile administrative Web existente.

## Limită

Nu se autorizează schimbarea secretelor, resetarea credentialelor Production, modificarea bazei de date, extinderea privilegiilor sau executarea de acțiuni administrative noi.

