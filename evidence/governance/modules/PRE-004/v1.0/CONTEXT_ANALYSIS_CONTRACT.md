# PRE-004 — Contract Analiză contextuală v1.0

1. Modulul este dezactivat implicit și nu conține analizori activi.
2. Cererea trebuie să aibă identitate, sursă și limbă acceptate, conținut limitat și referințe valide.
3. Datele personale și efectele externe sunt interzise în acest baseline.
4. Pornirea analizei necesită permis PRE-002 valid, neexpirat și legat exact de operațiune.
5. Permisul este consumat la tranziția în `analyzing`.
6. Fiecare constatare are ID unic, rezumat, confidence între 0 și 1 și cel puțin o referință-sursă.
7. Constatările necesită obligatoriu confirmarea utilizatorului.
8. Datele invalide sau lipsa trasabilității produc refuz sau resetare fail-closed.
9. Modulul nu modifică sursa, Basic, transportul sau contextul operațional.
10. Nu există apeluri externe, stocare ori monitorizare continuă.
