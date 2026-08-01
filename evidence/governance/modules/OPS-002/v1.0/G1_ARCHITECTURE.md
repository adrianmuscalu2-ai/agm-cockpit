# OPS-002 — Arhitectura G1

## Decizie

Baseline-ul Android rămâne neschimbat. Se adaugă un test contractual dedicat care verifică identitatea aplicației, versiunile SDK, pluginurile native, politica cleartext, allowlist-ul de permisiuni și suprafețele exportate.

## Criterii PASS

- `appId`, namespace și applicationId sunt coerente;
- numai activitatea launcher este exportată;
- FileProvider este privat și acordă URI temporar;
- release interzice cleartext, iar schema Capacitor este HTTPS;
- permisiunile sunt exact cele aprobate;
- cele trei pluginuri native sunt înregistrate;
- buildurile Web și APK sunt PASS;
- regresiile APP-003/APP-015 și MC-3A sunt PASS.

## NO-GO

Permisiune neaprobată, componentă exportată nejustificat, cleartext în release, pierderea pluginurilor, schimbarea App ID sau build eșuat.
