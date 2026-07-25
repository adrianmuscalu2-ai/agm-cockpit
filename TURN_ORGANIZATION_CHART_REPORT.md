# Turn Command Center — Official Organization Chart

Date: 2026-07-25
Status: **PASS — READY FOR CHECKPOINT**

## Reporting structure

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

Atlas and the Chief Monitoring Inspector are peers at level 2 and both report
directly to Adrian, Turn Commander.

## Mandatory agent contract

Agent creation requires:

- department;
- direct coordinator;
- reporting target;
- responsibility;
- access level;
- procedure;
- escalation level.

`createOrganizationAgent` rejects incomplete records, duplicate IDs, unknown
departments, missing coordinators, and missing reporting targets.

## Automatic placement test

Test agent: `Agent Monitorizare Rețea Test`

- department: `monitoring`;
- coordinator: `chief-monitoring-inspector`;
- reports to: `chief-monitoring-inspector`;
- expected hierarchy level: `3`;
- result: **PASS**.

A second record without `procedure` was rejected with
`ORGANIZATION_FIELD_REQUIRED:procedure`: **PASS**.

## Interaction

- hierarchy branches expand and collapse;
- selecting a department opens its branch and selects its first member;
- selecting an agent displays department, coordinator, reporting target,
  escalation, access, responsibility, procedure, and subordinate agents;
- Monitoring selection exposes all 12 monitoring agents immediately.

## Validation

- Web build: **PASS**
- Browser Shell regression: **PASS**
- UI LIVE: **PASS**
- Public/local routes: **8/8 HTTP 200**
- Organization interaction Desktop: **PASS**
- Organization interaction Mobile: **PASS**
- New-agent placement: **PASS**
- Required-field rejection: **PASS**
- Desktop capture:
  `.tmp/ui-live-audit/2026-07-25T18-58-32-237Z/turn-organization-desktop.png`
- Mobile capture:
  `.tmp/ui-live-audit/2026-07-25T18-58-32-237Z/turn-organization-mobile.png`

## Protection

- Contest baseline `7670640a7a8cdcd49418bfc85079c33105094d78` is unchanged.
- Public deployment is unchanged.
- The organization-chart change is stored in a separate Git checkpoint.
