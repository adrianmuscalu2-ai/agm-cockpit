# OPS-004 — Release, Deployment & Rollback — Dosar G0

**ID:** AGM-MOD-OPS-004-v1.0  
**Data:** 1 august 2026  
**Prioritate oficială:** 5  
**Stare G0:** PASS

## Scop

Guvernarea artefactelor de release, a ferestrelor de schimbare, a deploymentului controlat, a validării post-deployment și a rollback-ului recuperabil pentru AGM Cockpit.

## Responsabilități

- Module Owner: Release & Operations;
- executor tehnic: Release technical executor;
- monitorizare: MON-001 / MON-002 / MON-008 / MON-012;
- mentenanță: Release & Operations;
- QA: Independent Validator;
- Inspector: Architecture Guardian;
- documentație/arhivare: AGM Chronicler / Version Guardian;
- autoritate operațională: Adrian / Turn Commander.

## Continuitate protejată

Se păstrează checklisturile pre/post schimbare, separarea atribuțiilor, identitățile imuabile, Compose cu digest, systemd, backup/restore, planul de migrare, fallback-ul și rollback-ul fără ștergerea datelor.

## Autoritate și limită

Acest dosar autorizează numai proiectarea, verificarea statică, testarea și documentarea. Nu autorizează deploy, pornire/oprire servicii, migrare, rutare Cloudflare, acces la secrete, semnare sau publicare. Aceste acțiuni necesită mandat separat pentru o fereastră exactă.
