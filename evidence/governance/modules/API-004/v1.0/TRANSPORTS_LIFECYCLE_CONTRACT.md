# API-004 — Contract Transports Lifecycle v1

**Contract:** `transports-lifecycle.v1`  
**Stare inițială:** `imported`  
**Stare terminală:** `archived`

## Lanț canonic

`imported → accepted → at_pickup → pickup_completed → in_transport → at_delivery → delivery_completed → documents_submitted → paid → closed → archived`

Fiecare muchie are comandă, tip de validare, cod unic de eșec și verificare obligatorie a stării sursă.

## Invariante

- toate operațiile sunt izolate prin `companyId`;
- transportul altui tenant este tratat ca inexistent;
- tranziția rulează într-o tranzacție;
- verificările mandatory trebuie să fie `passed` sau `not_applicable`;
- eșecul produce raport de validare și audit, fără schimbarea stării;
- succesul leagă starea, istoricul, raportul și auditul;
- plata pozitivă creează ledger financiar;
- închiderea cere livrare, documente, plată și audit;
- arhivarea este permisă numai după `closed` și marchează transportul arhivat.

## NO-GO

- salt peste o stare sau tranziție dintr-o stare nepermisă;
- citire ori mutație cross-tenant;
- schimbare de stare fără validation report, audit și state history;
- plată nepozitivă sau închidere fără verificările obligatorii;
- ștergerea ori rescrierea istoricului;
- acces Production, migrare sau deployment fără mandat OPS-004.

