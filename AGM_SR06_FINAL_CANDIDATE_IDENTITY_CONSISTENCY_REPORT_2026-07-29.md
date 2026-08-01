# AGM — Final SR-06 Candidate Identity Consistency

Data: 2026-07-29  
Verdict: **PASS**

## Identitate canonică

| Suprafață | Valoare |
|---|---|
| Application ID | `com.agm.cockpit` |
| Android versionCode | `15` |
| Android versionName | `1.2.9-sr06-final` |
| Versiune UI | `A.G.M. Cockpit 1.2.9` |
| Service Worker registration | `agm-1.2.9` |
| Service Worker cache | `agm-cockpit-1.2.9` |

## Verificări

- nu există referințe active la `1.2.8`, `versionCode 14` sau
  `agm-1.2.8` în sursa, configurația ori assets-urile Android sincronizate;
- build-ul Web și assets-urile Android conțin UI 1.2.9,
  `AdminIncidentReportV1` și hardening-ul administrativ;
- manifestele Android intermediare și metadata de resources declară
  `versionCode 15` și `versionName 1.2.9-sr06-final`;
- versiunea afișată utilizatorului corespunde familiei de release Android
  1.2.9;
- baseline-ul MC-3A validează explicit build 15 și versionName final;
- MC-3A complet: PASS;
- Web Build: PASS — 189 module;
- graf Web: PASS — 167 fișiere, 0 cicluri;
- graf API: PASS — 81 fișiere, 0 cicluri.

Referințele 1.2.8 din APK-urile preexistente și rapoartele istorice sunt
intenționat păstrate ca dovezi de inventar. Acestea nu sunt configurație activă
și nu sunt utilizate drept identitate a candidatului.

## Inventar

Nu a fost generat încă APK-ul candidat. Identitatea sa rezervată este:

```text
com.agm.cockpit
versionCode 15
versionName 1.2.9-sr06-final
```

Hashul, dimensiunea și timestamp-ul candidatului vor fi înregistrate numai după
generarea unică autorizată.

Inventarul celor cinci APK-uri preexistente este neschimbat:

- patru copii de 7.604.172 bytes, SHA-256
  `C270161B6639ACA61534DF5C86F03ED0038F02B86EB9C08926C96B31A8D943F5`;
- un `app-debug.apk` de 22.277.627 bytes, SHA-256
  `38629C244D223673F8E512A96877529053690E8713F3DDC6D0AA54B691AD4ABF`.

`assembleDebug` nu a fost executat. Nu a fost generat sau instalat niciun APK,
iar telefonul nu a fost accesat.

## Observație suplimentară din testarea în teren

A fost raportat un test suplimentar pe un traseu de aproximativ 50 km, realizat
exclusiv prin conexiune de date mobile. Conform observației utilizatorului,
aplicația a funcționat normal pe întreaga perioadă a testului.

Această informație:

- completează dovezile de stabilitate în condiții reale de mobilitate și date
  mobile;
- este consemnată ca observație furnizată de utilizator, nu ca probă executată
  în cadrul prezentului gate;
- nu înlocuiește Final Device Validation SR-06;
- nu modifică matricea, criteriile de acceptare sau obligația verificării
  Diagnostics și `AdminIncidentReportV1` pe candidatul final;
- nu necesită nicio modificare tehnică și nu schimbă verdictul Readiness Gate.

## Verdict

**IDENTITY CONSISTENCY — PASS**

Identitatea candidatului este complet aliniată și pregătită pentru mandatul
separat de generare unică.
