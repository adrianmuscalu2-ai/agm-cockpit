# Raport de implementare — Etapele A–D

**Data:** 1 august 2026  
**Status:** PASS CONTRACT

## Etapa A

- contract `access-entitlements@1.0.0` în API și Web;
- tier implicit `basic`; Premium numai prin rolul explicit `PREMIUM_ACCESS`;
- endpoint autentificat read-only `GET /api/v1/auth/entitlements`;
- guard fail-closed; nicio modificare DB.

## Etapa B

- rută distinctă `/access` și view separat Basic/Premium;
- registrul shell actualizat;
- comportamentul Basic păstrat.

## Etapa C

- login API-002 din gateway-ul `/access`;
- token Bearer numai în `sessionStorage`; parola nu este stocată;
- verificare online a entitlement-ului și logout;
- HTTP 401 elimină sesiunea invalidă;
- același runtime Web este utilizabil în Android WebView.

## Etapa D

- permisiune Premium exclusiv în memorie după verificarea online;
- verificare capability pentru Command Center, Team și Load Safety;
- URL Premium direct revine fail-closed la Access;
- logout sau eroare elimină permisiunea;
- niciun snapshot local nu devine autoritate.

## Limita validării

Testarea fizică login → entitlement → Premium necesită un cont non-Production cu rolul `PREMIUM_ACCESS`. Crearea sau modificarea conturilor și rolurilor nu face parte din mandatul curent.
