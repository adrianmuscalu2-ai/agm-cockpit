# OPS-001 — Inventar interfețe G0

| Interfață | Direcție | Responsabilitate |
|---|---|---|
| Web Build | sursă → dist | trei entrypoint-uri și active versionate |
| Browser Router | URL ↔ APP-001 | fallback SPA către index.html |
| Service Worker | Browser ↔ cache/network | network-first și fallback offline shell |
| PWA Manifest | Browser ← artefact | start_url, scope și standalone |
| API public | Browser → API | HTTPS validat; health/probe fără cache |
| OPS-003 | runtime → monitorizare | Browser health și disponibilitate UI |
| OPS-004 | artefact → release | consumă build-ul numai sub mandat separat |

