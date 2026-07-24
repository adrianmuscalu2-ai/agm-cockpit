# AGM final alert and website execution report

Date: 2026-07-24

## Email alerting

Status: **FAIL — logic and delivery channel validated, permanent Windows transport not activated**

Implemented as a component independent from AGM Cockpit:

- local API check: `http://127.0.0.1:3000/api/v1/health/ready`;
- public access check: `https://api.agmcockpit.com/api/v1/health/ready`;
- two consecutive failures before alerting;
- one outage alert per incident;
- no repeated alert while the same outage remains active;
- one recovery message after the service returns;
- incident time, check result, affected service and action recommendation;
- persistent state outside Git;
- scheduled-task installer;
- SMTP credential encrypted for the Windows user and stored outside `.env`.

Automated logic test:

```text
first failure: no alert
second failure: one alert per failed service
third failure: no duplicate
first recovery: one recovery message per recovered service
second recovery: no duplicate
result: PASS
```

Live check:

```text
AGM API local: HTTP 200
AGM public access: HTTP 200
```

Controlled Gmail delivery proof:

```text
Subject: [AGM ALERT TEST CONTROLAT] Verificare mecanism alarmare 2026-07-24
Gmail message ID: 19f960eb1797a6a0
Labels: SENT, INBOX, UNREAD
Authenticated mailbox: agm.transporte.logistik@gmail.com
```

The test proves real Gmail send and receipt. It does not activate the unattended
Windows transport. Activation requires the operator to supply the approved SMTP
credential interactively through `Configure-AGM-Monitor.ps1`. No credential was
available during this execution, so the scheduled task was intentionally not
installed and the production result remains FAIL.

## Presentation website

Project:

```text
C:\Users\adria\Documents\AGM\agmcockpit-website
```

Classification: presentation/marketing website, separate from AGM Cockpit.

Runtime:

```text
Local PC: http://localhost:4321/
LAN / Android on the same network: http://192.168.178.86:4321/
Port: 4321
PID at validation: 15636
Command: .\node_modules\.bin\astro.cmd dev --background --host 0.0.0.0 --port 4321
```

Both local URLs returned HTTP 200 with title:

```text
AGM Cockpit | AI-assisted tools for professional drivers
```

Public presentation URL: **not configured**.

The following public URLs are AGM Cockpit, not the presentation website:

```text
https://app.agmcockpit.com/
https://agm-cockpit.pages.dev/
```

Both returned HTTP 200 with title `A.G.M. Cockpit`.

Website autostart after Windows restart: **not configured**. Astro currently runs in
background only for the active Windows session.

Browser-plugin validation was unavailable in the execution environment. The PC and
LAN results above are HTTP runtime evidence. No Android device was connected through
ADB, so an interactive Android browser PASS is not claimed.

## Governance

No existing AGM function was introduced, removed, disabled or behaviorally changed.
The alert monitor consists of new operational scripts and documentation explicitly
authorized by the request. Email Assistant, dictation, translation, PostgreSQL,
Cloudflare and existing application runtime files were not modified.
