# PRE-002 — Contract AI Governance v1.0

1. Orice modul AI trebuie înregistrat și activat explicit printr-un mandat ulterior.
2. Politica trebuie să existe, să fie activă, versionată și asociată modulului.
3. Kill switch activ blochează înaintea tuturor celorlalte verificări.
4. Riscul prohibit este întotdeauna blocat; riscul nu poate depăși politica.
5. Baseline-ul nu permite date personale sau efecte externe.
6. Inspectorul și utilizatorul confirmă separat aceeași operație.
7. Confirmările mai vechi de 5 minute sau viitoare sunt invalide.
8. Permisul este single-use, maximum 15 minute și legat de operație/modul/capabilitate/policy version.
9. Consumed, expired sau revoked nu pot reveni la issued.
10. Auditul consemnează coduri și rezultat fără conținut personal.

**Criteriu PASS:** fail-closed, risk/policy/confirmation gates, anti-replay, permise legate, kill switch și audit diferențiat.

**HOLD/NO-GO:** modul/politică dezactivată, risc prohibit, confirmare invalidă, permis reutilizat/divergent, date personale, efect extern sau kill switch activ.

