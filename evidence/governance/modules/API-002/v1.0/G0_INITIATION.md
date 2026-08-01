# API-002 — Deschidere dosar G0

**Modul:** Auth & Users  
**Data:** 1 august 2026  
**Principiu:** evoluție înainte de înlocuire

## Obiectiv și responsabilitate

API-002 autentifică utilizatorii, emite sesiuni JWT limitate la tenant și reconstruiește contextul autorizat al cererii din starea curentă a utilizatorului și rolurilor.

## Roluri

- Module Owner: Identity & Access Owner;
- implementare și mentenanță: API Engineering;
- monitorizare: OPS-003 Operations Health;
- QA: API QA;
- Inspector: Security & Architecture Inspector;
- documentație: Governance Documentation;
- aprobare finală: Product Owner / Turn Commander.

## Domeniu

Formalizarea contractului Auth & Users, protejarea loginului, izolarea tenantului, validarea stării utilizatorului și rolurilor și teste de regresie. Nu sunt autorizate deployment Production, migrații, acces la secrete sau schimbarea modelului de identitate.

