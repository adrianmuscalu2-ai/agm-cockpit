# AGM — Registrul de protecție a materialului de concurs

Data: 2026-07-28  
Statut: **FROZEN / PROTECTED**  
Aplicabilitate: consolidare arhitecturală, cleanup, modularizare și refactorizare

## 1. Decizie

Materialul aferent concursului este patrimoniu tehnic și istoric AGM. El rămâne
înghețat și nu poate fi:

- modificat;
- rescris;
- regenerat;
- redenumit;
- mutat;
- reorganizat;
- eliminat;
- inclus într-un cleanup;
- folosit ca țintă pentru formatare sau refactorizare;
- înlocuit de o versiune „mai nouă” fără mandat istoric distinct.

Consolidarea se aplică exclusiv ramurii active și nu poate altera materialul,
checkpoint-urile sau trasabilitatea concursului.

## 2. Referințe Git protejate identificate

| Referință | Commit | Observație |
| --- | --- | --- |
| `development/post-contest` | `9c3b374d319c0de3026484c6400f27c662cd16a6` | separarea explicită a dezvoltării post-concurs |
| `baseline/agm-basic-v1` | `7670640a7a8cdcd49418bfc85079c33105094d78` | baseline AGM Basic |
| tag `agm-cockpit-basic-v1.0.0` | obiect `e790dc4d7eda9aafef3af43484acb3a56be0fc12`, commit `7670640a7a8cdcd49418bfc85079c33105094d78` | checkpoint versionat |

Interdicții:

- nu se mută branch-urile protejate;
- nu se șterg sau recreează tagurile;
- nu se execută force-push;
- nu se rescrie istoricul care conține checkpoint-urile;
- nu se modifică referințele prin cleanup.

## 3. Artefacte protejate identificate

| Artefact | SHA-256 |
| --- | --- |
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| `audit_app_agmcockpit_2026-07-22.png` | `E098275C36AF0B27115FD5ED20A07C477F594737AFED74FCD5FE4666DD5B729C` |

Această listă este minimă și extensibilă. Un material de concurs neidentificat
în inventarul inițial rămâne protejat dacă proveniența, utilizarea sau contextul
îl asociază concursului.

## 4. Domeniu extins de protecție

Sunt protejate și:

- versiunile aplicației prezentate sau depuse;
- capturile, imaginile, grafica și materialele promoționale;
- textele de prezentare și formularele de depunere;
- scripturile video;
- demonstrațiile și înregistrările;
- rapoartele, dovezile și checksum-urile depunerii;
- checkpoint-urile și tagurile asociate;
- documentele care explică pregătirea și rezultatul concursului;
- istoricul Git necesar reconstituirii materialului;
- orice copie arhivată declarată oficială.

## 5. Reguli pentru consolidare

Înaintea oricărui increment de cleanup:

1. se verifică targetul față de acest registru;
2. se verifică istoricul și referințele Git;
3. se confirmă că targetul nu este consumat de materialul de concurs;
4. se compară checksum-urile artefactelor protejate;
5. se consemnează rezultatul în raport;
6. orice ambiguitate produce `STOP — PROTECTED SCOPE UNCLEAR`.

Un fișier partajat între aplicația activă și materialul concursului nu poate fi
modificat doar pentru că se află pe ramura activă. Este necesară analiza de
impact și demonstrarea faptului că patrimoniul înghețat rămâne reproductibil și
neschimbat.

## 6. Cleanup și documentație

Materialele protejate:

- nu se mută într-un director de arhivă în această etapă;
- nu sunt marcate `legacy` în sens de „candidat pentru eliminare”;
- nu sunt normalizate automat;
- nu sunt incluse în reorganizarea documentației;
- pot fi doar referențiate read-only.

Termenul corect de clasificare este:

**HISTORICAL CANONICAL ARTIFACT — FROZEN**

## 7. Verificare obligatorie după fiecare increment

- referințele Git protejate există;
- commiturile sunt neschimbate;
- fișierele protejate există;
- checksum-urile sunt identice;
- legăturile și trasabilitatea sunt păstrate;
- raportul confirmă explicit `COMPETITION MATERIAL: UNCHANGED`.

## 8. Autoritate

Nicio operație asupra domeniului protejat nu este autorizată de mandatul general
de consolidare. Orice excepție necesită:

- identificarea exactă a artefactului;
- justificare;
- analiză de impact;
- backup și checksum;
- mandat explicit Turn Command Center;
- validator independent;
- raport de conservare.

## 9. Verdict

# COMPETITION MATERIAL — FROZEN AND PROTECTED

Materialul de concurs este exclus integral din consolidarea arhitecturală,
cleanup și refactorizare.

