# API-002 — Inventar interfețe G0

## Interfețe publice

- `POST /api/v1/auth/login` — e-mail și parolă validate; maximum 5 încercări/minut, apoi blocare 60 secunde;
- `GET /api/v1/auth/me` — necesită Bearer JWT valid și returnează contextul curent.

## Dependențe

- DATA-001 / Prisma: User, UserRole și Role;
- API-001: prefix, validare HTTP, CORS, Helmet și throttling global;
- `JWT_SECRET` și `JWT_EXPIRES_IN`: configurare validată;
- bcryptjs: verificarea parolei.

## Consumatori

API-004…API-007 și aplicațiile autorizate consumă `RequestContext`: `userId`, `companyId`, roluri, request/correlation ID.

## Reguli de comunicare

Parola și hash-ul nu ies din serviciu. JWT conține exclusiv identitatea, tenantul, rolurile active și scope-ul `user`. La fiecare cerere protejată, utilizatorul, tenantul, scope-ul și rolurile sunt reverificate din persistence.

