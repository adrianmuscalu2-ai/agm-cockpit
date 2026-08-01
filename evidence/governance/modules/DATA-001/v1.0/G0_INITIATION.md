# DATA-001 — Prisma & PostgreSQL Persistence — Dosar G0

**ID:** AGM-MOD-DATA-001-v1.0  
**Data:** 1 august 2026  
**Stare G0:** PASS

## Scop

Protejarea schemei canonice Prisma, a istoricului migrațiilor PostgreSQL, a izolării tenant și a integrității datelor utilizate de toate modulele API.

## Responsabilități

- Module Owner: Data Accountable;
- dezvoltare și mentenanță: Backend & Data Custodian;
- monitorizare: MON-007 / MON-012;
- QA: Data Integrity QA independent;
- Inspector: Chief Inspector / Data Architecture;
- documentație și arhivare: AGM Chronicler / Version Guardian;
- validare finală: Adrian / Product Owner / Turn Commander.

## Baseline protejat

- provider PostgreSQL și `DATABASE_URL`;
- 15 modele canonice Prisma;
- cinci migrații istorice finalizate;
- câmpurile și indicii de izolare tenant;
- audit, validation reports și lifecycle transport;
- backup, restore rehearsal și single-writer definite prin OPS-004;
- PrismaService global și lifecycle connect/disconnect.

## Limită

Nu se autorizează migrare, `migrate deploy/dev`, acces la baza Production, reset, seed, DROP/TRUNCATE, modificarea containerului/volumului sau schimbarea single-writer.

