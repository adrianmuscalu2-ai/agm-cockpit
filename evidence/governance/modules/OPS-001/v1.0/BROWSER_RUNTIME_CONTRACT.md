# OPS-001 — Contract Browser Runtime v1

- entrypoint-uri obligatorii: `index.html`, `before-departure.html`, `after-departure.html`;
- ruta SPA necunoscută este rescrisă la `/index.html` cu HTTP 200;
- manifest: `start_url=/`, `scope=/`, `display=standalone`;
- shell minim precache: `/`, manifest și logo;
- strategie runtime: network-first;
- numai răspunsurile HTTP reușite pot intra în cache;
- probele health și `_agm_probe` folosesc `no-store`;
- navigarea offline nevizitată revine la shell-ul `/`;
- requesturile non-GET nu sunt interceptate;
- requesturile cross-origin nu sunt cache-uite local.

## NO-GO

- entrypoint lipsă;
- deep-link SPA fără fallback;
- health/probe servit din cache;
- răspuns HTTP nereușit memorat;
- API endpoint non-HTTPS în build Production;
- deployment sau modificare Production fără mandat OPS-004 distinct.

