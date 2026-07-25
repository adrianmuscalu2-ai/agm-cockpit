# TURN ARCHITECTURE V1 — Baseline oficial

Data arhivării: 2026-07-25  
Status: **PASS — BASELINE OFICIAL**

## Scop

Acest document fixează versiunea 1 a arhitecturii Turn Command Center ca punct
oficial de referință pentru dezvoltările ulterioare. Orice schimbare majoră a
structurii necesită un checkpoint nou și repetarea validărilor relevante.

Baseline-ul concursului
`7670640a7a8cdcd49418bfc85079c33105094d78` rămâne nemodificat. Acest baseline
de arhitectură este ulterior și separat.

## Structura oficială

```text
MENTOR
└── ADRIAN — TURN COMMANDER
    ├── ATLAS — Coordonare Operațională
    │   ├── Inspecție Basic
    │   ├── Inspecție Premium
    │   ├── Website
    │   ├── Browser
    │   ├── Android
    │   ├── AI
    │   ├── API
    │   ├── Baze de date
    │   ├── i18n
    │   ├── UX/UI
    │   ├── Release & Operations
    │   └── Alte departamente operaționale
    └── INSPECTOR ȘEF MONITORIZARE
        ├── Agent Monitorizare Server Principal
        ├── Agent Monitorizare Server Backup
        ├── Agent Monitorizare API
        ├── Agent Monitorizare Browser
        ├── Agent Monitorizare Android
        ├── Agent Monitorizare AI
        ├── Agent Monitorizare Bază de date
        ├── Agent Monitorizare Cloudflare / rute publice
        ├── Agent Monitorizare UI LIVE
        ├── Agent Monitorizare Telemetrie
        ├── Agent Monitorizare Incidente
        └── Agent de Securitate
```

ATLAS și Inspectorul Șef Monitorizare sunt coordonatori de nivel egal și
raportează direct către Turn Commander.

## Reguli obligatorii de coordonare și raportare

Fiecare agent are:

- departament;
- coordonator direct;
- destinație de raportare;
- responsabilitate;
- nivel de acces;
- procedură de intervenție;
- nivel de escaladare;
- lista agenților subordonați, unde este cazul.

Crearea unui agent este respinsă dacă lipsește oricare dintre câmpurile
obligatorii sau dacă departamentul, coordonatorul ori destinația de raportare nu
există. ID-urile duplicate sunt respinse. Poziția în organigramă este derivată
automat din departament și coordonator.

## Departamentul de Monitorizare

Departamentul cuprinde 12 agenți și folosește registrul comun de stare utilizat
de Operations Center și UI LIVE:

| Cod | Componentă | Sursa stării |
|---|---|---|
| MON-001 | Server Principal | API public `health/live` |
| MON-002 | Server Backup | Registrul infrastructurii / endpoint configurat |
| MON-003 | API | API public `health/ready` |
| MON-004 | Browser | Originea AGM și UI LIVE |
| MON-005 | Android | Registrul Android ADB/UI LIVE |
| MON-006 | AI | Dependența `translationProvider` |
| MON-007 | Bază de date | Dependența `database` |
| MON-008 | Cloudflare / rute publice | Rutele publice `agmcockpit.com` |
| MON-009 | UI LIVE | Raportul `pnpm audit:ui-live` |
| MON-010 | Incidente | Incident Journal reconciliat |
| MON-011 | Telemetrie | Registrul monitorizării continue |
| MON-012 | Securitate | API ready, CORS, politica UI LIVE și integritatea Git |

Stările informative precum `BACKUP ENDPOINT NOT CONFIGURED`,
`CLIENT ONLINE · TELEMETRY NOT CONFIGURED` și `MONITORING PENDING` nu sunt
incidente. Incidentele închise sau arhivate rămân în jurnal, dar nu intră în
contorul alertelor active.

Agentul de Securitate nu afișează și nu persistă PIN-uri, chei, tokenuri,
hash-uri, headere sau corpuri de răspuns.

## Validări arhivate

- Web Build: **PASS**
- Browser Shell Regression: **PASS**
- TypeScript: **PASS**
- UI LIVE: **PASS**
- Rute locale/publice: **8/8 HTTP 200**
- Organigramă Desktop: **PASS**
- Organigramă Mobile: **PASS**
- Extindere/restrângere ramuri: **PASS**
- Plasare automată agent nou: **PASS**
- Respingere agent incomplet: **PASS**
- Departament Monitorizare: **12/12 agenți**
- Buton Înapoi sus Desktop/Mobile: **PASS**
- Incidente active la validare: **0**

## Dovezi și integritate

| Artefact | SHA-256 |
|---|---|
| `evidence/turn-architecture-v1/turn-organization-desktop.png` | `7D0FF53388BBF6373F94356C1B57EDBE0C9A303BB8BAA2218445D674E49E345C` |
| `evidence/turn-architecture-v1/turn-organization-mobile.png` | `0B55D81B87431A242AB219E216B024C0E3080695CB83B47F87EB54CEE0FE74CE` |
| `evidence/turn-architecture-v1/ui-live-report.md` | `802A82BA8CFE32924586F3298C032E932A85A480B2BF20C09BAF99D41E70E63D` |

Documente componente:

- `TURN_ORGANIZATION_CHART_REPORT.md`;
- `TURN_MONITORING_DEPARTMENT_REPORT.md`;
- `TURN_INCIDENT_JOURNAL_VALIDATION.md`;
- `UI_LIVE_AUDIT.md`.

## Protecție și guvernanță

- deploymentul public nu este modificat de această arhivare;
- baseline-ul concursului rămâne intact;
- fișierele utilizatorului fără legătură cu etapa sunt excluse;
- secretele nu sunt incluse în documente, capturi sau jurnal;
- modificările structurale viitoare necesită checkpoint și validare noi.

