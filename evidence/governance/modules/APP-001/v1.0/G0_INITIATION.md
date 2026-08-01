# APP-001 — App Shell & Navigation — Dosar G0

**ID:** AGM-MOD-APP-001-v1.0  
**Data:** 1 august 2026  
**Stare G0:** PASS

## Scop

Bootstrap-ul aplicației Web, rutarea canonică și prin aliasuri, coordonarea stării compuse și lifecycle-ul vizual al tuturor modulelor UI.

## Responsabilități

- Module Owner: Frontend & Website Owner;
- dezvoltare și mentenanță: Frontend Experience / App Shell;
- monitorizare: MON-004 / MON-005 / MON-009;
- QA: Web Shell QA independent;
- Inspector: Chief Inspector / Frontend Architecture;
- documentație și arhivare: AGM Chronicler / Version Guardian;
- validare finală: Adrian / Product Owner / Turn Commander.

## Baseline protejat

- bootstrap-ul `main.ts` și Service Worker;
- registrul modulelor și cele trei entrypoint-uri;
- cele 11 slice-uri de stare cu proprietar unic;
- navigarea history/hash și fragmentele Turn;
- render/bind per modul și restaurarea sesiunii administrative;
- rutele Premium gestionate separat;
- caracterizările MC-3A, SR-03 și E6.3.

## Limită

Nu se autorizează rescrierea shell-ului, schimbarea modulelor funcționale, deployment, modificarea Service Worker-ului sau migrarea completă din `legacy-main`.

