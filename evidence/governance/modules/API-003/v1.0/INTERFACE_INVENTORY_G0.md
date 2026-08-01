# API-003 — Inventar interfețe G0

## API

- `POST /api/v1/translation/actions/translate-text` — maximum 20 cereri/minut;
- `GET /api/v1/translation/health` — maximum 30 cereri/minut, rezultat cache-uit 60 secunde.

## Dependențe

- API-001: HTTP perimeter, environment și readiness;
- OpenAI Responses API: provider extern;
- `OPENAI_API_KEY`, model și timeout din configurația validată;
- OPS-003: health, failure, recovery și incidente.

## Consumatori

APP-002 Translator și modulele lingvistice APP-006/APP-008. Inputul este limitat la 4000 caractere și limbile ro/de/en.

Textul sursă, cheia API și mesajele brute ale providerului nu sunt incluse în logurile operaționale.

