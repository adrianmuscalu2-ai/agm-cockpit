# Ordinea recomandată de integrare și implementare

## Principiu

Nu se începe cu ecranele existente. Se creează mai întâi coloana vertebrală
contractuală, apoi se adaptează capabilitățile reutilizabile.

| Ordine | Pachet | Motiv | Rezultat necesar |
|---:|---|---|---|
| 1 | Mapare Premium–TransportJob | închide conflictul C-01 / ADR-006 | ADR și tabel de mapare aprobate |
| 2 | Model canonic TripContext | dependență pentru toate modulele | DTO, versiuni, actor, permissions |
| 3 | Nucleul lifecycle Premium | autoritate unică de tranziție | state machine testată |
| 4 | AuditEvent + Confirmation + Issue transfer | trasabilitate transversală | porturi și modele comune |
| 5 | Persistență locală, outbox, recovery | elimină outbox-urile insulare | adaptor comun demonstrat |
| 6 | Orchestrator și Application Registry | înlocuiește registrul plat | comenzi, guards, projections |
| 7 | Premium Foundation, Shell și Routes | transformă catalogul în flux | navigare dependentă de lifecycle |
| 8 | Pre-departure | cea mai matură bază reutilizabilă | PRM-01/02/04 integrate |
| 9 | AI Governance | gard înaintea oricărei activări AI | permit legat de trip/actor/version |
| 10 | Context + Linguistic + Copilot + Recommendations | servicii transversale controlate | rezultate cu proveniență și audit |
| 11 | Load Safety | reproiectare pe porturi și agregate | PRM-03 fără singleton/fetch direct |
| 12 | After-departure | conectare la TRIP_ACTIVE/ARRIVAL | PRM-07/08 și transfer incidente |
| 13 | Document/OCR comun | scoate OCR din Load Safety | PRM-06 și media canonică |
| 14 | Raport, jurnal și arhivare | închide ciclul | PRM-09/10, COMPLETED/ARCHIVED |
| 15 | integrare Browser/Android și staging | validare finală | G5–G7 |

## Decizii de refactorizare

- Pre-departure nu se rescrie integral; se extrag regulile și se înlocuiesc
  identitatea, lifecycle-ul și outbox-ul local cu porturi comune.
- After-departure păstrează evaluatorul pur și renunță la lifecycle-ul paralel ca
  autoritate asupra cursei.
- Load Safety păstrează tipurile/quality/report, dar controllerul global, stările
  singleton și API-urile directe nu se migrează ca atare.
- Fundațiile AI rămân dezactivate până când AI Governance este integrat.

## Porți pentru deschiderea implementării

1. acceptarea Product Owner a Contractului v1;
2. închiderea ADR-006;
3. aprobarea TripContext și a modelului de identitate;
4. aprobarea porturilor Audit/Confirmation/Sync;
5. scope și fișiere autorizate pentru primul increment;
6. plan de regresie Basic și Premium Foundation;
7. confirmare explicită că nu se publică.

Prima etapă de implementare recomandată este **2.1 — TripContext și maparea
lifecycle**, nu adaptarea unui ecran.
