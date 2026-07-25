# AGM UI Live Audit

- Run: `2026-07-25T18-58-32-237Z`
- Started: 2026-07-25T18:58:32.237Z
- Finished: 2026-07-25T18:59:15.051Z
- Result: **PASS**
- Browser mode: headless isolated Chromium

| Service | URL | HTTP | Desktop | Mobile | Result | Checked at | Error |
|---|---|---:|---|---|---|---|---|
| AGM Browser local | `http://127.0.0.1:5173/` | 200 | PASS | PASS | **PASS** | 2026-07-25T18:58:32.450Z |  |
| Turn Command Center local | `http://127.0.0.1:5173/turn` | 200 | PASS | PASS | **PASS** | 2026-07-25T18:58:36.439Z |  |
| AGM Website local | `http://127.0.0.1:4321/` | 200 | PASS | PASS | **PASS** | 2026-07-25T18:58:45.596Z |  |
| API AGM ready local | `http://127.0.0.1:3000/api/v1/health/ready` | 200 | N/A | N/A | **PASS** | 2026-07-25T18:58:50.181Z |  |
| AGM Browser public | `https://app.agmcockpit.com/` | 200 | PASS | PASS | **PASS** | 2026-07-25T18:58:50.192Z |  |
| Turn Command Center public | `https://app.agmcockpit.com/turn` | 200 | PASS | PASS | **PASS** | 2026-07-25T18:58:59.704Z |  |
| API AGM ready public | `https://api.agmcockpit.com/api/v1/health/ready` | 200 | N/A | N/A | **PASS** | 2026-07-25T18:59:04.621Z |  |
| AGM Website public | `https://agm-cockpit.pages.dev/` | 200 | PASS | PASS | **PASS** | 2026-07-25T18:59:04.839Z |  |

## Security

- Browser contexts are isolated and start without user cookies or local storage.
- Request/response bodies and HTTP headers are not written to the report.
- URL query strings, fragments, credentials, and common secret patterns are removed from logs.

