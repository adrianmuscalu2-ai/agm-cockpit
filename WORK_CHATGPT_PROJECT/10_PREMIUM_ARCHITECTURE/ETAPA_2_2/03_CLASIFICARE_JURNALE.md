# Livrabil 3 — Clasificarea jurnalelor operaționale

| Clasă | Conținut | Canonic? | Retenție aplicată prin |
|---|---|---|---|
| L1 Lifecycle | tranziții, guards, respingeri | da | cursă + politică |
| L2 Confirmation | confirmări umane critice | da | tip confirmare |
| L3 Checks & Warnings | răspunsuri, verificări, warnings | da | severitate/scop |
| L4 Incident | deschidere, escaladare, rezoluție | da | severitate/jurisdicție |
| L5 Evidence | metadate foto/document/hash | da, metadate | tip dovadă |
| L6 AI & Automation | cereri, permit, model/rule version, rezultat | da | clasificare date |
| L7 Communication | mesaj/translation provenance și status | selectiv | scop operațional |
| L8 Sync & Recovery | outbox, ack, conflict, recovery | da | diagnostic operațional |
| L9 Security & Access | acces privilegiat, export, policy denial | da | politică security |
| L10 Technical Diagnostic | erori fără conținut operațional sensibil | selectiv | diagnostic |

## Surse existente și destinație

| Sursă actuală | Decizie |
|---|---|
| Prisma `AuditEvent` | se extinde/adaptează la anvelopa canonică |
| `TransportJobStateHistory` | rămâne proiecție specializată corelată cu eventId |
| `BusinessValidationReport` | artefact corelat, nu jurnal paralel |
| AI Governance audit types | produc evenimente L6 canonice |
| Proactive Recommendation audit | produce evenimente L6/L3 canonice |
| Pre-departure outbox | transport de evenimente, nu arhivă |
| Turn `incident-journal.ts` | jurnal tehnic separat; nu se amestecă automat cu Trip |
| `IncidentReport` backend | agregat operațional; schimbările emit L4 |

Jurnalele modulelor sunt adaptoare sau proiecții. Niciun modul Premium nu își
definește propriul EventStore.
