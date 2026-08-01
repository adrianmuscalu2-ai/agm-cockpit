# OPS-001 — Browser Runtime — Dosar G0

**ID:** AGM-MOD-OPS-001-v1.0  
**Data:** 1 august 2026  
**Stare G0:** PASS

## Scop

Asigurarea unui runtime Browser predictibil pentru artefactul Web AGM Cockpit: entrypoint-uri, navigare SPA, PWA/Service Worker, cache controlat și compatibilitate cu API-ul public.

## Responsabilități

- Module Owner: Frontend & Website Owner;
- dezvoltare și mentenanță: Web Runtime / Release Operations;
- monitorizare: MON-004 / MON-009;
- QA: Browser Runtime QA independent;
- Inspector: Chief Inspector / Runtime Architecture;
- documentație și arhivare: AGM Chronicler / Version Guardian;
- validare finală: Adrian / Product Owner / Turn Commander.

## Baseline protejat

- definiția unică a build-ului Web;
- entrypoint-urile main, before-departure și after-departure;
- manifestul PWA și înregistrarea Service Worker;
- endpointul API HTTPS validat la build;
- probele health fără cache;
- suita MC-3A și definiția SR-01;
- procedura OPS-004, fără execuție Production.

## Limită

Nu se autorizează deployment, modificarea Cloudflare, API, PostgreSQL, secrete, cache Production sau Service Worker activ pe dispozitivele utilizatorilor.

